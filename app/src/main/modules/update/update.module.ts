import { app } from "electron";
import { type AppUpdater, autoUpdater, CancellationToken } from "electron-updater";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { IpcModule } from "../ipc.module";
import { ConfigModule } from "../config/config.module";
import { VaultModule } from "../vault/vault.module";
import { AutoLockModule } from "../security/auto-lock.module";
import { log } from "../../utils/logs.utils";
import { mainConfig } from "@shared/config/main.config";
import type { AppConfig } from "@shared/config/app.config";
import type { UpdateStatus } from "@shared/types/update.types";
import { releaseProvider } from "./release.provider";
import { canCheck, fromUpdateInfo, isDowngrade, isNoReleaseError, shortErrorMessage } from "./update.status";

/**
 * Updates the application from the GitHub releases (electron-updater).
 *
 * A newer release of the selected channel (stable, beta or dev, each also following the more stable releases) is downloaded as soon as it is found and installed
 * on restart or when the application quits. An older one (after a channel change) is only downloaded and installed
 * on the user's request.
 */
@injectable()
export class UpdateModule extends LogModule {
	private readonly autoUpdater: AppUpdater = autoUpdater;
	private settings: AppConfig["updates"] | null = null;
	private checkTimeout: NodeJS.Timeout | undefined;
	private downloadCancellation: CancellationToken | null = null;
	/** The vault was shut down for the installer: an install error must give it back to the renderer */
	private installing = false;
	private status: UpdateStatus = {
		state: "idle",
		currentVersion: app.getVersion(),
		latestVersion: null,
		releaseDate: null,
		releaseNotes: null,
		downgrade: false,
		progress: null,
		lastCheckAt: null,
		nextCheckAt: null,
		error: null,
		isPackaged: app.isPackaged,
	};

	public constructor(
		@inject(IpcModule) private readonly ipcModule: IpcModule,
		@inject(ConfigModule) private readonly configModule: ConfigModule,
		@inject(VaultModule) private readonly vaultModule: VaultModule,
		@inject(AutoLockModule) private readonly autoLockModule: AutoLockModule
	) {
		super("UpdateModule");
		this.autoUpdater.logger = this.logger;
		// Downloads are started by this module: a downgrade waits for the user
		this.autoUpdater.autoDownload = false;
		this.autoUpdater.autoInstallOnAppQuit = false;
		if (!app.isPackaged) {
			this.autoUpdater.forceDevUpdateConfig = true;
			this.logger.info("Development build: update checks are enabled by dev-app-update.yml");
		}
		// Releases picked by channel (dev → beta → stable), app-update.yml still gives the download cache folder
		const { owner, repo } = mainConfig.autoUpdate.repository;
		this.autoUpdater.setFeedURL(releaseProvider(owner, repo, () => this.settings?.channel ?? "stable"));

		this.autoUpdater.on("checking-for-update", () => this.setStatus({ state: "checking", error: null }));
		this.autoUpdater.on("update-available", (info) => {
			const downgrade = isDowngrade(this.status.currentVersion, info.version);
			this.setStatus({ state: "available", downgrade, ...fromUpdateInfo(info) });
			// Development builds are not installable (no AppImage, no installer): downloads stay manual
			if (!downgrade && app.isPackaged) void this.download();
		});
		this.autoUpdater.on("update-not-available", (info) => this.setStatus({ state: "up-to-date", downgrade: false, ...fromUpdateInfo(info) }));
		this.autoUpdater.on("download-progress", (progress) => this.setStatus({ state: "downloading", progress: progress.percent }));
		this.autoUpdater.on("update-downloaded", (info) => {
			// Development builds never install, a downgrade only on the user's request
			this.autoUpdater.autoInstallOnAppQuit = app.isPackaged && !this.status.downgrade;
			this.setStatus({ state: "downloaded", progress: 100, ...fromUpdateInfo(info) });
		});
		this.autoUpdater.on("error", (error) => {
			this.logger.error("Update failed", error);
			this.fail(error);
			if (this.installing) {
				// The installer could not start: the renderer shows the locked vault
				this.installing = false;
				void this.vaultModule.notifyState();
			}
		});
	}

	public getStatus(): UpdateStatus {
		return this.status;
	}

	/**
	 * Applies the settings, then checks for a release when automatic checks are on (packaged builds only)
	 */
	@log("info")
	public async start() {
		this.applySettings((await this.configModule.getConfig()).updates);
		if (app.isPackaged && this.settings?.autoCheck) await this.check();
	}

	/**
	 * Called when the user saves the settings: a channel change drops the pending update and checks again when automatic checks are on
	 */
	@log()
	public async onSettingsChanged(previous: AppConfig["updates"], next: AppConfig["updates"]) {
		this.applySettings(next);

		if (previous.channel !== next.channel) {
			this.dropPendingUpdate();
			if (next.autoCheck) await this.check();
			else this.schedule();
			return;
		}

		if (!previous.autoCheck && next.autoCheck) await this.check();
		else if (previous.autoCheck && !next.autoCheck) this.schedule();
	}

	/**
	 * Checks GitHub for a new release, then again every {@link mainConfig.autoUpdate.checkDelay} minutes when automatic checks are on
	 */
	@log("info")
	public async check() {
		if (!canCheck(this.status.state)) return;

		try {
			const result = await this.autoUpdater.checkForUpdates();
			// Development builds without dev-app-update.yml resolve without any event
			if (!result && this.status.state === "checking") this.setStatus({ state: "idle" });
		} catch (error) {
			this.fail(error as Error);
		} finally {
			this.setStatus({ lastCheckAt: new Date().toISOString() });
			this.schedule();
		}
	}

	/**
	 * Downloads the release found: automatic for a newer release, on the user's request for a downgrade (and in development)
	 */
	@log("info")
	public async download() {
		if (this.status.state !== "available") return;

		const cancellation = new CancellationToken();
		this.downloadCancellation = cancellation;
		this.setStatus({ state: "downloading", progress: 0, error: null });
		try {
			await this.autoUpdater.downloadUpdate(cancellation);
		} catch (error) {
			// A cancelled download already reset the status, the "error" event reports the others
			if (!cancellation.cancelled) this.logger.warn("Download failed", (error as Error).message);
		} finally {
			if (this.downloadCancellation === cancellation) this.downloadCancellation = null;
		}
	}

	/**
	 * Locks the vault, stops `bw serve` and clears the clipboard, then restarts on the downloaded release.
	 *
	 * The shutdown runs first: the installer replaces the binary used by the `bw serve` process.
	 */
	@log("info")
	public async quitAndInstall() {
		if (this.status.state !== "downloaded" || !app.isPackaged) return;

		this.installing = true;
		this.autoLockModule.stop();
		await this.vaultModule.shutdown();
		// Quits once the installer started, otherwise emits "error"
		this.autoUpdater.quitAndInstall(true, true);
	}

	/**
	 * A channel without any release is not an error; other errors are shortened for the renderer (logged in full)
	 */
	private fail(error: Error & { code?: string }) {
		if (isNoReleaseError(error)) this.setStatus({ state: "no-release", progress: null, error: null, latestVersion: null, releaseNotes: null, downgrade: false });
		else this.setStatus({ state: "error", progress: null, error: shortErrorMessage(error.message) });
	}

	private applySettings(settings: AppConfig["updates"]) {
		// The channel is read by the release provider at each check
		this.settings = settings;
		// An older release of the channel is offered, never downloaded nor installed without the user's request
		this.autoUpdater.allowDowngrade = true;
	}

	/**
	 * Forgets the release found on the previous channel: cancels its download and never installs it
	 */
	private dropPendingUpdate() {
		this.downloadCancellation?.cancel();
		this.downloadCancellation = null;
		this.autoUpdater.autoInstallOnAppQuit = false;
		this.setStatus({ state: "idle", latestVersion: null, releaseDate: null, releaseNotes: null, downgrade: false, progress: null, error: null });
	}

	private schedule() {
		clearTimeout(this.checkTimeout);
		this.checkTimeout = undefined;

		if (!app.isPackaged || !this.settings?.autoCheck) {
			this.setStatus({ nextCheckAt: null });
			return;
		}

		const delay = mainConfig.autoUpdate.checkDelay * 60 * 1000;
		this.checkTimeout = setTimeout(() => void this.check(), delay);
		this.setStatus({ nextCheckAt: new Date(Date.now() + delay).toISOString() });
	}

	private setStatus(patch: Partial<UpdateStatus>) {
		this.status = { ...this.status, ...patch };
		this.ipcModule.sendToMainWindow("update:status", this.status);
	}
}
