import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, type Rectangle, session, shell } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { ConfigModule } from "../config/config.module";
import { IpcModule } from "../ipc.module";
import { CertificateModule } from "../security/certificate.module";
import { mainConfig } from "@shared/config/main.config";
import { log } from "@main/utils/logs.utils";

@injectable()
export class WindowModule extends LogModule {
	private mainWindow: BrowserWindow | null = null;

	public constructor(
		@inject(MainContextModule) private readonly mainContextModule: MainContextModule,
		@inject(ConfigModule) private readonly configModule: ConfigModule,
		@inject(IpcModule) private readonly ipcModule: IpcModule,
		@inject(CertificateModule) private readonly certificateModule: CertificateModule
	) {
		super("WindowModule");
	}

	/**
	 * Adresse chargée par la fenêtre : seuls ses messages IPC sont acceptés
	 */
	public get rendererUrl() {
		return is.dev && process.env["ELECTRON_RENDERER_URL"] ? process.env["ELECTRON_RENDERER_URL"] : null;
	}

	/**
	 * Refuse toute permission web, toute navigation et toute nouvelle fenêtre
	 */
	public hardenSession() {
		session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
		session.defaultSession.setPermissionCheckHandler(() => false);

		// Favicons come from the server: accept the authorities approved in the application, nothing else
		session.defaultSession.setCertificateVerifyProc((request, callback) => {
			const authorityInvalid = request.errorCode === -202;
			callback(authorityInvalid && this.certificateModule.isApprovedForChromium(request.hostname, request.certificate.data) ? 0 : -3);
		});

		app.on("web-contents-created", (_, contents) => {
			contents.on("will-navigate", (event) => event.preventDefault());
			contents.on("will-attach-webview", (event) => event.preventDefault());
			contents.setWindowOpenHandler(() => ({ action: "deny" }));
		});
	}

	@log()
	public async createMainWindow() {
		const { bounds } = (await this.configModule.getConfig()).window;

		const mainWindow = new BrowserWindow({
			width: 1180,
			height: 760,
			minWidth: 820,
			minHeight: 540,
			show: false,
			frame: false,
			title: mainConfig.names.public,
			backgroundColor: "#0a0a0a",
			// Taskbar and title icon (the Windows executable icon comes from build/icon.ico)
			icon: join(app.getAppPath(), "resources", "icon.png"),
			autoHideMenuBar: true,
			webPreferences: {
				preload: join(__dirname, "../preload/index.js"),
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
				webSecurity: true,
				spellcheck: false,
				devTools: this.mainContextModule.allowDebug,
			},
		});

		this.mainWindow = mainWindow;
		if (bounds) this.restoreBounds(mainWindow, bounds);

		mainWindow.on("maximize", () => this.ipcModule.sendToMainWindow("app:screen:toggle-full-screen", true));
		mainWindow.on("unmaximize", () => this.ipcModule.sendToMainWindow("app:screen:toggle-full-screen", false));
		mainWindow.once("ready-to-show", () => mainWindow.show());
		mainWindow.on("close", () => {
			const { x, y, width, height } = mainWindow.getNormalBounds();
			void this.configModule.update((config) => ({ ...config, window: { bounds: { x, y, width, height } } }));
		});
		mainWindow.on("closed", () => {
			this.mainWindow = null;
		});

		if (this.rendererUrl) {
			await mainWindow.loadURL(this.rendererUrl);
		} else {
			await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
		}

		return mainWindow;
	}

	/**
	 * With fractional display scaling, a frameless window ends up a few pixels larger than requested:
	 * compensate once, otherwise the window grows at each launch
	 */
	private restoreBounds(window: BrowserWindow, bounds: Rectangle) {
		window.setBounds(bounds);
		const actual = window.getBounds();
		if (actual.width !== bounds.width || actual.height !== bounds.height) {
			window.setBounds({ ...bounds, width: 2 * bounds.width - actual.width, height: 2 * bounds.height - actual.height });
		}
	}

	public get window() {
		return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
	}

	public focusMainWindow() {
		const window = this.mainWindow;
		if (!window) return;
		if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
	}

	/**
	 * Ouvre une adresse web dans le navigateur par défaut ; tout autre protocole est refusé
	 */
	public async openExternal(url: string) {
		const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new Error(`Protocole non autorisé : ${parsed.protocol}`);
		}
		await shell.openExternal(parsed.toString());
	}
}
