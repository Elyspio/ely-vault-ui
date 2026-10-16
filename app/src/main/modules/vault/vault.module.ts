import crypto from "node:crypto";
import { net } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { BwCliModule } from "../bitwarden/bw.cli.module";
import { BwServeModule } from "../bitwarden/bw.serve.module";
import { ClipboardModule } from "../security/clipboard.module";
import { IpcModule } from "../ipc.module";
import { CertificateModule } from "../security/certificate.module";
import { SshKeyModule } from "./ssh.key.module";
import type { SshKeyMaterial } from "./ssh.keys";
import { log } from "@main/utils/logs.utils";
import { BwError, type BwCollection, type BwFolder, type BwItem, type BwList, type BwMessage, type BwOrganization, type BwStatus, type BwString } from "../bitwarden/bw.types";
import { getPlainValue, getSecretValue, getTotpPeriod, isSecretRef, sanitizeItem } from "./vault.mapper";
import { generateEncodedSecret } from "./password.generator";
import { applyDraft, checkFolderDelete, isConflictError, planFolderRename, validateDraft } from "./vault.writer";
import { folderSegments, joinFolderSegments } from "@shared/vault/folder.path";
import { CipherType } from "@shared/types/vault.types";
import type {
	CopyRef,
	ItemDraft,
	LoginRequest,
	LoginResult,
	PasswordGeneratorOptions,
	SecretRef,
	SessionState,
	TotpCode,
	UnlockResult,
	VaultSnapshot,
	WriteOutcome,
	WriteResult,
} from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";
import { OfflineAccessModule, VAULT_SYNC_INTERVAL_MS } from "./offline-access.module";

/** How long a successful master password reprompt unlocks protected items */
const REPROMPT_GRACE_MS = 5 * 60 * 1000;

/** `bw serve` answers a write before its local cache shows it: the reload is retried until the change appears */
const SETTLE_ATTEMPTS = 10;
const SETTLE_DELAY_MS = 150;
/** Wait for the vault server before telling that it does not answer */
const SERVER_CHECK_TIMEOUT_MS = 5000;

/** Shown when the SSH key of a draft is no longer held (expired, or the vault was locked) */
const SSH_KEY_EXPIRED = appMessage("sshKeyExpired");
const VAULT_LOCKED = appMessage("vaultLocked");

/** Whether a reloaded snapshot already shows a successful write (`done`: ids written) */
type Settled = (snapshot: VaultSnapshot, done: string[]) => boolean;

/**
 * Session and vault access on top of `bw serve`.
 *
 * Decrypted items stay in this process only, and only while the vault is unlocked.
 */
@injectable()
export class VaultModule extends LogModule {
	/** Active (not deleted) decrypted items, by id */
	private items = new Map<string, BwItem>();
	/** Decrypted items of the trash, by id: the only ones a restore or a permanent delete accepts */
	private trash = new Map<string, BwItem>();
	/** Raw folders, as the CLI lists them (kept for folder writes) */
	private folders: BwFolder[] = [];
	private snapshot: VaultSnapshot | null = null;
	/** Incremented by every clear: a result computed for a previous session is discarded */
	private generation = 0;
	/** Tail of the write and sync queue: operations run one after the other */
	private queue: Promise<unknown> = Promise.resolve();
	/** scrypt hash of the master password, kept in memory while unlocked to check reprompts offline */
	private repromptVerifier: { salt: Buffer; hash: Buffer } | null = null;
	private repromptValidUntil = 0;
	private readonly icons = new Map<string, string | null>();
	private serverUrl: string | null = null;
	private accessTimer: NodeJS.Timeout | null = null;
	private expiryTimer: NodeJS.Timeout | null = null;
	private deadlineTimer: NodeJS.Timeout | null = null;
	private backgroundSync: Promise<void> | null = null;

	public constructor(
		@inject(BwCliModule) private readonly bwCliModule: BwCliModule,
		@inject(BwServeModule) private readonly bwServeModule: BwServeModule,
		@inject(ClipboardModule) private readonly clipboardModule: ClipboardModule,
		@inject(IpcModule) private readonly ipcModule: IpcModule,
		@inject(CertificateModule) private readonly certificateModule: CertificateModule,
		@inject(SshKeyModule) private readonly sshKeyModule: SshKeyModule,
		@inject(OfflineAccessModule) private readonly offlineAccess: OfflineAccessModule
	) {
		super("VaultModule");
		// Without the master password, a crashed CLI server cannot be unlocked again: an open session locks
		this.bwServeModule.onUnexpectedExit(() => {
			if (!this.isUnlocked) return;
			this.logger.warn("bw serve stopped unexpectedly: locking");
			void this.lock().catch((error: unknown) => this.logger.warn("Lock after bw serve exit failed", errorMessage(error)));
		});
	}

	// region Session

	public async getState(): Promise<SessionState> {
		let template: BwStatus["template"];
		await this.offlineAccess.loadLimit();

		if (this.bwServeModule.isRunning) {
			template = (await this.bwServeModule.request<BwStatus>("GET", "/status")).template;
		} else {
			// `bw serve` refuses to start without an account
			template = await this.bwCliModule.status();
			if (template.status !== "unauthenticated") {
				await this.bwServeModule.ensureStarted();
				template = (await this.bwServeModule.request<BwStatus>("GET", "/status")).template;
			}
		}

		this.serverUrl = template.serverUrl;
		this.offlineAccess.select(template);
		if (this.snapshot && this.offlineAccess.block) {
			await this.lock();
			return await this.getState();
		}
		if (template.status === "unlocked" && !this.snapshot) {
			// A CLI unlock alone is not an authorized ElyVault session.
			await this.bwServeModule.request("POST", "/lock").catch(() => this.bwServeModule.stop());
			template = { ...template, status: "locked" };
		}
		if (template.status !== "unlocked") this.clear();

		return {
			status: template.status,
			serverUrl: template.serverUrl,
			email: template.userEmail ?? null,
			lastSync: template.lastSync,
			accessBlock: template.status === "unauthenticated" ? undefined : this.offlineAccess.block,
		};
	}

	@log("info")
	public async login(request: LoginRequest): Promise<LoginResult> {
		const serverUrl = normalizeServerUrl(request.serverUrl);
		if (!serverUrl) return { status: "error", message: appMessage("invalidServerAddress") };

		// The CLI only says "certificate error": check first, so the user can review and approve the certificate
		const certificate = await this.certificateModule.check(serverUrl);
		if (certificate.status === "untrusted") return { status: "untrusted-certificate", certificate: certificate.certificate };
		if (certificate.status === "unreachable") return { status: "error", message: appMessage("serverUnreachableDetail", { detail: certificate.message }) };

		// Login, logout and server config write the CLI data file: the server must be down
		await this.bwServeModule.stop();
		this.clear();

		try {
			const status = await this.bwCliModule.status();
			if (status.status !== "unauthenticated") await this.bwCliModule.logout();
			if (status.serverUrl !== serverUrl) await this.bwCliModule.configServer(serverUrl);

			if (request.sso) await this.bwCliModule.loginSso();
			else await this.bwCliModule.login(request.email.trim(), request.password, request.twoFactor);
			this.offlineAccess.select(await this.bwCliModule.status());
			this.offlineAccess.authenticated();
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") return { status: "error", message: appMessage("ssoCancelled") };
			const message = errorMessage(error);
			// CLI message only: the password goes through the environment, never in arguments or output
			this.logger.warn("Login failed", message);
			if (/SSO sign-in is required/i.test(message)) return { status: "sso-required" };
			// No code yet: the server asked for one (or just sent it by e-mail)
			if (!request.twoFactor?.code && (request.twoFactor || isTwoFactorError(message))) return { status: "two-factor-required" };
			return { status: "error", message: translateError(message) };
		}

		const unlock = await this.unlock(request.password);
		return unlock.status === "success" ? { status: "success" } : unlock;
	}

	public cancelLogin() {
		this.bwCliModule.cancelSso();
	}

	@log("info")
	public async unlock(password: string): Promise<UnlockResult> {
		await this.bwServeModule.ensureStarted();
		const { template } = await this.bwServeModule.request<BwStatus>("GET", "/status");
		this.serverUrl = template.serverUrl;
		this.offlineAccess.select(template);
		if (this.offlineAccess.block === "authentication-required") return { status: "error", message: appMessage("vaultAuthenticationRequired") };
		const unreachable = await this.checkServer();
		if (unreachable) return { status: "error", message: unreachable };
		try {
			await this.bwServeModule.request<BwMessage>("POST", "/unlock", { password });
		} catch (error) {
			// The CLI runs its key migrations after unlocking and does not catch their failures
			// (e.g. Vaultwarden has no user key id endpoint): the vault may be unlocked despite the error
			const status = await this.bwServeModule.request<BwStatus>("GET", "/status").catch(() => null);
			if (status?.template.status !== "unlocked") return { status: "error", message: translateError(errorMessage(error)) };
			this.logger.warn("Unlock reported an error but the vault is unlocked", errorMessage(error));
		}

		const salt = crypto.randomBytes(16);
		this.repromptVerifier = { salt, hash: crypto.scryptSync(password, salt, 32) };

		const generation = this.generation;
		return await this.enqueue(async () => {
			this.ensureGeneration(generation);
			try {
				// Plain sync can skip downloading when the server's account revision has not advanced.
				await this.syncVerified(generation);
			} catch (error) {
				this.logger.warn("Sync after unlock failed", errorMessage(error));
				if (this.offlineAccess.block === "authentication-required") return { status: "error", message: this.accessMessage() };
				this.ensureGeneration(generation);
				if (this.offlineAccess.block) {
					const message = this.accessMessage();
					await this.lock();
					return { status: "error", message };
				}
			}
			try {
				try {
					await this.loadSnapshot(generation);
				} catch (error) {
					// Offline, the CLI can crash on its failed token refresh (unhandled rejection): unlock a new server once
					if (!(await this.reopenDeadServe(password, generation))) throw error;
					await this.loadSnapshot(generation);
				}
			} catch (error) {
				if (generation === this.generation) await this.lock();
				throw error;
			}
			this.startAccessTimers();
			return { status: "success" };
		});
	}

	/**
	 * Once offline access expired, unlocking needs the vault server: message when it does not answer, null otherwise.
	 * Any HTTP answer counts, only network failures (VPN off, DNS, timeout) mean unreachable.
	 */
	public async checkServer(): Promise<string | null> {
		if (this.offlineAccess.block !== "offline-expired" || !this.serverUrl) return null;
		try {
			await net.fetch(`${this.serverUrl}/alive`, { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(SERVER_CHECK_TIMEOUT_MS) });
			return null;
		} catch (error) {
			this.logger.warn("Vault server unreachable before unlocking", errorMessage(error));
			return appMessage("vaultServerUnreachable", { host: new URL(this.serverUrl).host });
		}
	}

	/** Whether `bw serve` still answers with an unlocked vault */
	private async serveAlive() {
		return await this.bwServeModule
			.request<BwStatus>("GET", "/status")
			.then(({ template }) => template.status === "unlocked")
			.catch(() => false);
	}

	/** Restarts and unlocks `bw serve` when it died after unlocking; false when it is still running */
	private async reopenDeadServe(password: string, generation: number) {
		if (generation !== this.generation || (await this.serveAlive())) return false;
		this.logger.warn("bw serve stopped after unlocking: restarting it");
		await this.bwServeModule.stop();
		await this.bwServeModule.ensureStarted();
		this.ensureGeneration(generation);
		await this.bwServeModule.request<BwMessage>("POST", "/unlock", { password }).catch(() => undefined);
		this.ensureGeneration(generation);
		if (!(await this.serveAlive())) throw new BwError(VAULT_LOCKED);
		return true;
	}

	@log("info")
	public async lock() {
		try {
			this.offlineAccess.observe(true);
		} catch {
			this.logger.warn("Could not persist access clock before locking");
		}
		this.clear();
		if (this.bwServeModule.isRunning) {
			await this.bwServeModule.request("POST", "/lock").catch(() => this.bwServeModule.stop());
		}
		await this.clipboardModule.clearIfOwned();
		this.ipcModule.sendToMainWindow("session:state", await this.getState());
	}

	/**
	 * Pushes the session state to the renderer after a change it did not ask for
	 */
	public async notifyState() {
		this.ipcModule.sendToMainWindow("session:state", await this.getState());
	}

	@log("info")
	public async logout() {
		await this.bwServeModule.stop();
		this.clear();
		this.icons.clear();
		await this.clipboardModule.clearIfOwned();
		const status = await this.bwCliModule.status();
		if (status.status !== "unauthenticated") await this.bwCliModule.logout();
	}

	/**
	 * Locks and stops the CLI server, when the application quits
	 */
	public async shutdown() {
		try {
			this.offlineAccess.observe(true);
		} catch {
			this.logger.warn("Could not persist access clock before shutdown");
		}
		this.clear();
		await this.clipboardModule.clearIfOwned();
		await this.bwServeModule.stop();
	}

	public get isUnlocked() {
		if (!this.snapshot) return false;
		if (this.offlineAccess.block) {
			void this.lock().catch((error: unknown) => this.logger.warn("Access expiry lock failed", errorMessage(error)));
			return false;
		}
		return true;
	}

	private clear() {
		if (this.accessTimer) clearInterval(this.accessTimer);
		if (this.expiryTimer) clearInterval(this.expiryTimer);
		if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
		this.accessTimer = null;
		this.expiryTimer = null;
		this.deadlineTimer = null;
		this.generation++;
		this.items.clear();
		this.trash.clear();
		this.folders = [];
		this.snapshot = null;
		this.repromptVerifier = null;
		this.repromptValidUntil = 0;
		this.sshKeyModule.clear();
	}

	// endregion

	// region Vault

	public async getSnapshot(): Promise<VaultSnapshot> {
		this.ensureAccess();
		if (!this.snapshot) throw new BwError(VAULT_LOCKED);
		return this.snapshot;
	}

	@log("info")
	public async sync(): Promise<VaultSnapshot> {
		return this.enqueue(async () => {
			this.ensureAccess();
			if (!this.snapshot) throw new BwError(VAULT_LOCKED);
			const generation = this.generation;
			await this.syncVerified(generation);
			try {
				return await this.loadSnapshot(generation);
			} catch (error) {
				if (generation === this.generation) await this.lock();
				throw error;
			}
		});
	}

	/**
	 * Reads the vault from `bw serve`. Nothing is published when the session changed while reading (lock)
	 */
	private async loadSnapshot(generation = this.generation): Promise<VaultSnapshot> {
		this.ensureAccess();
		// The CLI filters the archive state exactly: deleted items that were archived need their own request
		const [items, deletedItems, deletedArchivedItems, folders, organizations, collections, status] = await Promise.all([
			this.bwServeModule.request<BwList<BwItem>>("GET", "/list/object/items"),
			this.bwServeModule.request<BwList<BwItem>>("GET", "/list/object/items?trash=true"),
			this.bwServeModule.request<BwList<BwItem>>("GET", "/list/object/items?trash=true&archived=true"),
			this.bwServeModule.request<BwList<BwFolder>>("GET", "/list/object/folders"),
			this.bwServeModule.request<BwList<BwOrganization>>("GET", "/list/object/organizations"),
			this.bwServeModule.request<BwList<BwCollection>>("GET", "/list/object/collections"),
			this.bwServeModule.request<BwStatus>("GET", "/status"),
		]);
		this.ensureGeneration(generation);
		this.ensureAccess();
		if (!this.offlineAccess.matches(status.template)) {
			await this.lock();
			throw new BwError(VAULT_LOCKED);
		}

		const trashItems = [...deletedItems.data, ...deletedArchivedItems.data];
		const active = items.data.filter((item) => !item.deletedDate);
		this.items = new Map(active.map((item) => [item.id, item]));
		this.trash = new Map(trashItems.map((item) => [item.id, item]));
		this.folders = folders.data;

		this.snapshot = {
			items: active.map(sanitizeItem),
			trash: trashItems.map(sanitizeItem),
			// The CLI adds a virtual "No folder" entry without id
			folders: folders.data.filter((f): f is BwFolder & { id: string } => Boolean(f.id)).map(({ id, name }) => ({ id, name })),
			organizations: organizations.data.map(({ id, name }) => ({ id, name })),
			collections: collections.data.map(({ id, organizationId, name }) => ({ id, organizationId, name })),
			lastSync: status.template.lastSync,
		};

		return this.snapshot;
	}

	public async getSecret(itemId: string, ref: SecretRef): Promise<string> {
		const item = this.getItem(itemId);
		this.ensureRepromptSatisfied(item);
		const value = getSecretValue(item, ref);
		if (value === null) throw new BwError("Value not found");
		return value;
	}

	public async copy(itemId: string | null, ref: CopyRef) {
		this.ensureAccess();
		const generation = this.generation;
		if (ref.kind === "text") {
			await this.clipboardModule.copy(ref.value);
			if (generation !== this.generation || this.offlineAccess.block) await this.clipboardModule.clearIfOwned();
			return;
		}

		const item = this.getItem(itemId!);
		let value: string | null;

		if (ref.kind === "totp") {
			value = (await this.getTotp(itemId!)).code;
		} else if (isSecretRef(ref)) {
			value = await this.getSecret(itemId!, ref);
		} else {
			value = getPlainValue(item, ref);
		}

		if (value === null) throw new BwError("Value not found");
		this.ensureGeneration(generation);
		this.ensureAccess();
		await this.clipboardModule.copy(value);
		if (generation !== this.generation || this.offlineAccess.block) await this.clipboardModule.clearIfOwned();
	}

	public async getTotp(itemId: string): Promise<TotpCode> {
		const generation = this.generation;
		const item = this.getItem(itemId);
		this.ensureRepromptSatisfied(item);

		const { data: code } = await this.bwServeModule.request<BwString>("GET", `/object/totp/${encodeURIComponent(itemId)}`);
		this.ensureGeneration(generation);
		this.ensureAccess();
		const period = getTotpPeriod(item.login?.totp);
		const remaining = period - (Math.floor(Date.now() / 1000) % period);

		return { code, period, remaining };
	}

	/**
	 * Decrypted item, for the main process only, once its master password reprompt is satisfied
	 */
	public getProtectedItem(itemId: string): BwItem {
		const item = this.getItem(itemId);
		this.ensureRepromptSatisfied(item);
		return item;
	}

	public verifyReprompt(password: string): boolean {
		const valid = this.checkMasterPassword(password);
		if (valid) this.repromptValidUntil = Date.now() + REPROMPT_GRACE_MS;
		return valid;
	}

	/**
	 * Checks the master password of the unlocked vault, without network call
	 */
	public checkMasterPassword(password: string): boolean {
		if (!this.isUnlocked) return false;
		if (!this.repromptVerifier) return false;
		const hash = crypto.scryptSync(password, this.repromptVerifier.salt, 32);
		return crypto.timingSafeEqual(hash, this.repromptVerifier.hash);
	}

	public async generatePassword({ mode, length, special }: PasswordGeneratorOptions) {
		const safeLength = Math.min(Math.max(Math.trunc(length) || 20, 8), 128);
		if (mode === "hex" || mode === "base64") return generateEncodedSecret(mode, safeLength);

		const { data } = await this.bwServeModule.request<BwString>("GET", `/generate?length=${safeLength}&uppercase&lowercase&number${special ? "&special" : ""}`);
		return data;
	}

	/**
	 * Website icon through the server's icon service (same request as the official clients), as a data URL
	 */
	public async getIcon(host: string): Promise<string | null> {
		if (!/^[a-z0-9.-]+$/i.test(host) || !this.serverUrl) return null;
		if (this.icons.has(host)) return this.icons.get(host)!;

		let dataUrl: string | null = null;
		try {
			const response = await net.fetch(`${this.serverUrl}/icons/${host}/icon.png`, { credentials: "omit", cache: "force-cache" });
			const contentType = response.headers.get("content-type") ?? "";
			if (response.ok && contentType.startsWith("image/")) {
				const buffer = Buffer.from(await response.arrayBuffer());
				dataUrl = `data:${contentType.split(";")[0]};base64,${buffer.toString("base64")}`;
			}
		} catch (error) {
			this.logger.debug("Icon fetch failed", host, errorMessage(error));
		}

		this.icons.set(host, dataUrl);
		return dataUrl;
	}

	private getItem(itemId: string) {
		this.ensureAccess();
		const item = this.items.get(itemId);
		if (!item) throw new BwError(this.snapshot ? appMessage("itemNotFound") : VAULT_LOCKED);
		return item;
	}

	private ensureRepromptSatisfied(item: BwItem) {
		if (item.reprompt === 1 && Date.now() > this.repromptValidUntil) {
			throw new BwError("REPROMPT_REQUIRED");
		}
	}

	private ensureGeneration(generation: number) {
		if (generation !== this.generation) throw new BwError(VAULT_LOCKED);
	}

	private accessMessage() {
		return appMessage(this.offlineAccess.block === "authentication-required" ? "vaultAuthenticationRequired" : "vaultOfflineExpired");
	}

	/** Synchronous gate also covers auto-type and requests arriving before the timer fires. */
	private ensureAccess() {
		if (!this.offlineAccess.block) return;
		const message = this.accessMessage();
		void this.lock().catch((error: unknown) => this.logger.warn("Access expiry lock failed", errorMessage(error)));
		throw new BwError(message);
	}

	private async syncVerified(generation: number) {
		try {
			await this.bwServeModule.request<BwMessage>("POST", "/sync?force=true");
			this.ensureGeneration(generation);
			const { template } = await this.bwServeModule.request<BwStatus>("GET", "/status");
			this.ensureGeneration(generation);
			if (template.status === "unauthenticated") throw new BwError("You are not logged in.");
			if (template.status !== "unlocked" || !template.lastSync || !Number.isFinite(Date.parse(template.lastSync))) throw new BwError(appMessage("vaultOfflineExpired"));
			if (!this.offlineAccess.matches(template)) {
				await this.lock();
				throw new BwError(VAULT_LOCKED);
			}
			this.offlineAccess.verified();
			if (this.snapshot) this.scheduleExpiry();
		} catch (error) {
			this.ensureGeneration(generation);
			const status = await this.bwServeModule.request<BwStatus>("GET", "/status").catch(() => null);
			this.ensureGeneration(generation);
			if (isAuthenticationRejection(errorMessage(error)) || status?.template.status === "unauthenticated") {
				return await this.rejectAuthentication();
			}
			throw error;
		}
	}

	private async rejectAuthentication(): Promise<never> {
		try {
			this.offlineAccess.reject();
		} finally {
			await this.lock();
		}
		throw new BwError(appMessage("vaultAuthenticationRequired"));
	}

	private startAccessTimers() {
		if (this.accessTimer) clearInterval(this.accessTimer);
		if (this.expiryTimer) clearInterval(this.expiryTimer);
		this.accessTimer = setInterval(() => void this.refreshAccess(), VAULT_SYNC_INTERVAL_MS);
		this.expiryTimer = setInterval(() => {
			try {
				if (this.isUnlocked) this.offlineAccess.observe();
			} catch (error) {
				void this.lock().catch(() => undefined);
				this.logger.warn("Access clock observation failed", errorMessage(error));
			}
		}, 1000);
		this.accessTimer.unref();
		this.expiryTimer.unref();
		this.scheduleExpiry();
	}

	private scheduleExpiry() {
		if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
		this.deadlineTimer = setTimeout(
			() => {
				if (this.offlineAccess.block) void this.lock().catch((error: unknown) => this.logger.warn("Access expiry lock failed", errorMessage(error)));
				else this.scheduleExpiry();
			},
			Math.max(1, Math.ceil(this.offlineAccess.remainingMs))
		);
		this.deadlineTimer.unref();
	}

	/** Applies a changed offline access window: an open session past the new deadline locks at once */
	public async onAccessLimitChanged() {
		await this.offlineAccess.loadLimit();
		if (!this.isUnlocked) return;
		if (this.offlineAccess.block) await this.lock();
		else this.scheduleExpiry();
	}

	/** Resume checks expiry synchronously before attempting network renewal. */
	public refreshAccess(): Promise<void> {
		if (!this.isUnlocked) return Promise.resolve();
		this.backgroundSync ??= this.sync()
			.then((snapshot) => {
				if (this.isUnlocked && this.snapshot === snapshot) this.ipcModule.sendToMainWindow("vault:snapshot", snapshot);
			})
			.catch((error: unknown) => {
				this.logger.warn("Automatic vault sync failed", errorMessage(error));
			})
			.finally(() => {
				this.backgroundSync = null;
			});
		return this.backgroundSync;
	}

	/**
	 * Runs a task after the previous ones; a failed task does not break the queue
	 */
	private enqueue<T>(task: () => Promise<T>): Promise<T> {
		const result = this.queue.then(task);
		this.queue = result.catch(() => undefined);
		return result;
	}

	/**
	 * Runs a write in the queue and reloads the snapshot afterwards.
	 *
	 * Failures of the write become its outcome, except the ones that must reach the renderer as errors
	 * (reprompt, locked vault). A failed reload does not hide the outcome: the snapshot is null instead.
	 * The reload is repeated a few times until `settled` sees the change.
	 */
	private async write(task: () => Promise<WriteOutcome>, settled?: Settled): Promise<WriteResult> {
		return this.enqueue(async () => {
			this.ensureAccess();
			if (!this.snapshot) throw new BwError(VAULT_LOCKED);
			const generation = this.generation;
			let outcome: WriteOutcome;
			try {
				outcome = await task();
			} catch (error) {
				// Locked during the write: the CLI error says so in its own words
				this.ensureGeneration(generation);
				const message = errorMessage(error);
				if (isAuthenticationRejection(message)) {
					return await this.rejectAuthentication();
				}
				if (isFatalWriteError(message)) throw error;
				outcome = { status: "error", message: translateError(message) };
			}
			this.ensureGeneration(generation);

			const done = outcome.status === "success" ? (outcome.done ?? (outcome.id ? [outcome.id] : [])) : outcome.status === "partial" ? outcome.done : [];
			try {
				let snapshot = await this.loadSnapshot(generation);
				for (let attempt = 1; settled && done.length > 0 && !settled(snapshot, done) && attempt < SETTLE_ATTEMPTS; attempt++) {
					await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));
					snapshot = await this.loadSnapshot(generation);
				}
				// Still not there (the server answered with stale values): a sync brings the server's state
				if (settled && done.length > 0 && !settled(snapshot, done)) {
					await this.syncVerified(generation);
					snapshot = await this.loadSnapshot(generation);
				}
				return { outcome, snapshot, refreshError: null };
			} catch (error) {
				if (generation === this.generation) await this.lock();
				return { outcome, snapshot: null, refreshError: translateError(errorMessage(error)) };
			}
		});
	}

	/**
	 * Runs operations one after the other, stopping at the first failure: one operation gives success or error,
	 * several give partial with what was done
	 */
	private async runSequence(steps: { id: string; run: () => Promise<unknown> }[]): Promise<WriteOutcome> {
		const done: string[] = [];
		for (const step of steps) {
			try {
				await step.run();
				done.push(step.id);
			} catch (error) {
				const message = errorMessage(error);
				if (isAuthenticationRejection(message)) {
					return await this.rejectAuthentication();
				}
				if (isFatalWriteError(message)) throw error;
				if (steps.length === 1) return { status: "error", message: translateError(message) };
				return { status: "partial", done, failed: { id: step.id, message: translateError(message) } };
			}
		}
		return { status: "success", id: steps.length === 1 ? steps[0].id : null, done };
	}

	/**
	 * Key of a draft: null when the draft keeps the current key, the held key when it replaces it, an error when its token is gone
	 */
	private draftKey(draft: ItemDraft): { key: SshKeyMaterial | null } | { status: "error"; message: string } {
		if (draft.type !== CipherType.SshKey || !draft.sshKey) return { key: null };
		const key = this.sshKeyModule.peek(draft.sshKey.token);
		return key ? { key } : { status: "error", message: SSH_KEY_EXPIRED };
	}

	/**
	 * Forgets the key of a draft once its item is saved
	 */
	private consumeKey(draft: ItemDraft) {
		if (draft.type === CipherType.SshKey && draft.sshKey) this.sshKeyModule.take(draft.sshKey.token);
	}

	/**
	 * Fresh raw item from the server (the cached copy may be older than the server's)
	 */
	private async fetchItem(id: string): Promise<BwItem> {
		return await this.bwServeModule.request<BwItem>("GET", `/object/item/${encodeURIComponent(id)}`);
	}

	// endregion

	// region Writes

	/**
	 * Creates a personal item from the editor draft
	 */
	@log("info")
	public async createItem(draft: ItemDraft): Promise<WriteResult> {
		return this.write(async () => {
			const key = this.draftKey(draft);
			if ("status" in key) return key;

			const error = validateDraft(null, draft, key.key);
			if (error) return { status: "error", message: error };

			const created = await this.bwServeModule.request<BwItem>("POST", "/object/item", applyDraft(null, draft, key.key));
			this.consumeKey(draft);
			return { status: "success", id: created.id };
		}, hasItems);
	}

	/**
	 * Edits an item with the draft; nothing is written when the item changed since `expectedRevision`
	 */
	@log("info")
	public async updateItem(itemId: string, expectedRevision: string, draft: ItemDraft): Promise<WriteResult> {
		let revision: string | null = null;
		return this.write(
			async () => {
				this.ensureRepromptSatisfied(this.getItem(itemId));

				const fresh = await this.fetchItem(itemId);
				if (fresh.revisionDate !== expectedRevision) return { status: "conflict" };

				const key = this.draftKey(draft);
				if ("status" in key) return key;

				const error = validateDraft(fresh, draft, key.key);
				if (error) return { status: "error", message: error };

				try {
					revision = (await this.bwServeModule.request<BwItem>("PUT", `/object/item/${encodeURIComponent(itemId)}`, applyDraft(fresh, draft, key.key))).revisionDate;
				} catch (writeError) {
					if (!isConflictError(errorMessage(writeError))) throw writeError;
					// The server has a newer copy: resync so the reload shows it
					await this.syncVerified(this.generation);
					return { status: "conflict" };
				}
				this.consumeKey(draft);
				return { status: "success", id: itemId };
			},
			// The folder and favorite are checked too: the server may answer with their previous values
			(snapshot) =>
				hasRevision(snapshot, itemId, revision) && snapshot.items.some((item) => item.id === itemId && item.folderId === draft.folderId && item.favorite === draft.favorite)
		);
	}

	/**
	 * Moves an active item to the trash
	 */
	@log("info")
	public async deleteItem(itemId: string): Promise<WriteResult> {
		return this.write(
			async () => {
				this.ensureRepromptSatisfied(this.getItem(itemId));

				await this.bwServeModule.request("DELETE", `/object/item/${encodeURIComponent(itemId)}`);
				return { status: "success", id: itemId };
			},
			(snapshot, done) => done.every((id) => snapshot.trash.some((item) => item.id === id))
		);
	}

	/**
	 * Takes an item back from the trash
	 */
	@log("info")
	public async restoreItem(itemId: string): Promise<WriteResult> {
		return this.write(async () => {
			if (!this.trash.has(itemId)) return { status: "error", message: appMessage("itemNotInTrash") };

			await this.bwServeModule.request("POST", `/restore/item/${encodeURIComponent(itemId)}`);
			return { status: "success", id: itemId };
		}, hasItems);
	}

	/**
	 * Permanently deletes items of the trash. Every id is checked (and every reprompt) before the first deletion.
	 */
	@log("info")
	public async purgeItems(itemIds: string[]): Promise<WriteResult> {
		return this.write(
			async () => {
				const ids = [...new Set(itemIds)];
				if (ids.length === 0) return { status: "error", message: appMessage("noItemSelected") };
				if (ids.some((id) => !this.trash.has(id))) return { status: "error", message: appMessage("itemNotInTrash") };
				for (const id of ids) this.ensureRepromptSatisfied(this.trash.get(id)!);

				return this.runSequence(
					ids.map((id) => ({
						id,
						run: () => this.bwServeModule.request("DELETE", `/object/item/${encodeURIComponent(id)}?permanent=true`),
					}))
				);
			},
			(snapshot, done) => !snapshot.trash.some((item) => done.includes(item.id))
		);
	}

	/**
	 * Marks an active item as favorite, or not
	 */
	@log("info")
	public async setFavorite(itemId: string, favorite: boolean): Promise<WriteResult> {
		return this.write(
			async () => {
				this.getItem(itemId);

				const fresh = await this.fetchItem(itemId);
				await this.bwServeModule.request("PUT", `/object/item/${encodeURIComponent(itemId)}`, { ...fresh, favorite });
				return { status: "success", id: itemId };
			},
			(snapshot) => snapshot.items.some((item) => item.id === itemId && item.favorite === favorite)
		);
	}

	/**
	 * Moves an active item to a folder, or to no folder (null)
	 */
	@log("info")
	public async moveItem(itemId: string, folderId: string | null): Promise<WriteResult> {
		return this.write(
			async () => {
				this.getItem(itemId);
				if (folderId !== null && !this.folders.some((folder) => folder.id === folderId)) return { status: "error", message: appMessage("folderNotFound") };

				const fresh = await this.fetchItem(itemId);
				await this.bwServeModule.request("PUT", `/object/item/${encodeURIComponent(itemId)}`, { ...fresh, folderId });
				return { status: "success", id: itemId };
			},
			(snapshot) => snapshot.items.some((item) => item.id === itemId && item.folderId === folderId)
		);
	}

	/**
	 * Creates a folder from its path ("Work/Projects")
	 */
	@log("info")
	public async createFolder(name: string): Promise<WriteResult> {
		return this.write(async () => {
			const segments = folderSegments(name);
			if (segments.length === 0) return { status: "error", message: appMessage("folderNameEmpty") };

			const normalized = joinFolderSegments(segments);
			const exists = this.folders.some((folder) => folder.id !== null && joinFolderSegments(folderSegments(folder.name)) === normalized);
			if (exists) return { status: "error", message: appMessage("folderExists") };

			const created = await this.bwServeModule.request<BwFolder>("POST", "/object/folder", { name: normalized });
			return { status: "success", id: created.id };
		}, hasFolders);
	}

	/**
	 * Renames a folder path and every folder under it
	 */
	@log("info")
	public async renameFolder(path: string, newPath: string): Promise<WriteResult> {
		let names = new Map<string, string>();
		return this.write(
			async () => {
				const plan = planFolderRename(this.folders, path, newPath);
				if ("error" in plan) return { status: "error", message: plan.error };
				names = new Map(plan.renames.map((rename) => [rename.id, rename.name]));

				return this.runSequence(
					plan.renames.map((rename) => ({
						id: rename.id,
						run: () => this.bwServeModule.request("PUT", `/object/folder/${encodeURIComponent(rename.id)}`, { name: rename.name }),
					}))
				);
			},
			(snapshot, done) => done.every((id) => snapshot.folders.some((folder) => folder.id === id && folder.name === names.get(id)))
		);
	}

	/**
	 * Deletes a folder, refused while it holds an active item or sub folders
	 */
	@log("info")
	public async deleteFolder(folderId: string): Promise<WriteResult> {
		return this.write(
			async () => {
				const blocked = checkFolderDelete(this.folders, [...this.items.values()], folderId);
				if (blocked) return { status: "error", message: blocked };

				await this.bwServeModule.request("DELETE", `/object/folder/${encodeURIComponent(folderId)}`);
				return { status: "success", id: folderId };
			},
			(snapshot, done) => !snapshot.folders.some((folder) => done.includes(folder.id))
		);
	}

	// endregion
}

function normalizeServerUrl(value: string): string | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "https:") return null;
		return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
	} catch {
		return null;
	}
}

function hasItems(snapshot: VaultSnapshot, ids: string[]) {
	return ids.every((id) => snapshot.items.some((item) => item.id === id));
}

function hasFolders(snapshot: VaultSnapshot, ids: string[]) {
	return ids.every((id) => snapshot.folders.some((folder) => folder.id === id));
}

function hasRevision(snapshot: VaultSnapshot, itemId: string, revision: string | null) {
	return revision === null || snapshot.items.some((item) => item.id === itemId && item.revisionDate === revision);
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Errors that reach the renderer as errors instead of the outcome of a write: reprompt and locked vault
 */
function isFatalWriteError(message: string) {
	return message === "REPROMPT_REQUIRED" || message === VAULT_LOCKED || message === appMessage("vaultOfflineExpired") || message === appMessage("vaultAuthenticationRequired");
}

/** CLI errors lose their HTTP envelope: recognize explicit rejection, never generic outages. */
export function isAuthenticationRejection(message: string) {
	return /\b(?:HTTP\s*|status(?:Code)?["']?\s*[:=]\s*)(?:401|403)\b|\bunauthorized\b|\bunauthenticated\b|not logged in|invalid_grant|(?:invalid|expired|revoked) (?:refresh |access )?token|(?:session|token) (?:has )?expired|stamp has changed|authentication (?:failed|required)/i.test(
		message
	);
}

function isTwoFactorError(message: string) {
	// Non-interactive CLI: "Code is required." when the account has two-step login
	return /two[- ]?(step|factor)|provider|2fa|code is required/i.test(message);
}

function translateError(message: string) {
	if (/username or password is incorrect/i.test(message)) return appMessage("incorrectCredentials");
	if (/decryption operation failed|invalid master password/i.test(message)) return appMessage("incorrectMasterPassword");
	if (/two[- ]?step token is invalid|invalid.*code/i.test(message)) return appMessage("invalidVerificationCode");
	if (/fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(message)) return appMessage("serverUnreachable");
	if (/certificate|self[- ]signed|UNABLE_TO_VERIFY/i.test(message)) return appMessage("certificateNotRecognized");
	return message;
}
