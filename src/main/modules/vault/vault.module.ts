import crypto from "node:crypto";
import { net } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { BwCliModule } from "../bitwarden/bw.cli.module";
import { BwServeModule } from "../bitwarden/bw.serve.module";
import { ClipboardModule } from "../security/clipboard.module";
import { IpcModule } from "../ipc.module";
import { CertificateModule } from "../security/certificate.module";
import { log } from "@main/utils/logs.utils";
import { BwError, type BwCollection, type BwFolder, type BwItem, type BwList, type BwMessage, type BwOrganization, type BwStatus, type BwString } from "../bitwarden/bw.types";
import { getPlainValue, getSecretValue, getTotpPeriod, isSecretRef, sanitizeItem } from "./vault.mapper";
import type { CopyRef, LoginRequest, LoginResult, SecretRef, SessionState, TotpCode, UnlockResult, VaultSnapshot } from "@shared/types/vault.types";

/** How long a successful master password reprompt unlocks protected items */
const REPROMPT_GRACE_MS = 5 * 60 * 1000;

/**
 * Session and vault access on top of `bw serve`.
 *
 * Decrypted items stay in this process only, and only while the vault is unlocked.
 */
@injectable()
export class VaultModule extends LogModule {
	private items = new Map<string, BwItem>();
	private snapshot: VaultSnapshot | null = null;
	/** scrypt hash of the master password, kept in memory while unlocked to check reprompts offline */
	private repromptVerifier: { salt: Buffer; hash: Buffer } | null = null;
	private repromptValidUntil = 0;
	private readonly icons = new Map<string, string | null>();
	private serverUrl: string | null = null;

	public constructor(
		@inject(BwCliModule) private readonly bwCliModule: BwCliModule,
		@inject(BwServeModule) private readonly bwServeModule: BwServeModule,
		@inject(ClipboardModule) private readonly clipboardModule: ClipboardModule,
		@inject(IpcModule) private readonly ipcModule: IpcModule,
		@inject(CertificateModule) private readonly certificateModule: CertificateModule
	) {
		super("VaultModule");
	}

	// region Session

	public async getState(): Promise<SessionState> {
		let template: BwStatus["template"];

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
		if (template.status !== "unlocked") this.clear();

		return {
			status: template.status,
			serverUrl: template.serverUrl,
			email: template.userEmail ?? null,
			lastSync: template.lastSync,
		};
	}

	@log("info")
	public async login(request: LoginRequest): Promise<LoginResult> {
		const serverUrl = normalizeServerUrl(request.serverUrl);
		if (!serverUrl) return { status: "error", message: "Adresse du serveur invalide (https:// requis)" };

		// The CLI only says "certificate error": check first, so the user can review and approve the certificate
		const certificate = await this.certificateModule.check(serverUrl);
		if (certificate.status === "untrusted") return { status: "untrusted-certificate", certificate: certificate.certificate };
		if (certificate.status === "unreachable") return { status: "error", message: `Serveur injoignable : ${certificate.message}` };

		// Login, logout and server config write the CLI data file: the server must be down
		await this.bwServeModule.stop();
		this.clear();

		try {
			const status = await this.bwCliModule.status();
			if (status.status !== "unauthenticated") await this.bwCliModule.logout();
			if (status.serverUrl !== serverUrl) await this.bwCliModule.configServer(serverUrl);

			await this.bwCliModule.login(request.email.trim(), request.password, request.twoFactor);
		} catch (error) {
			const message = errorMessage(error);
			// No code yet: the server asked for one (or just sent it by e-mail)
			if (!request.twoFactor?.code && (request.twoFactor || isTwoFactorError(message))) return { status: "two-factor-required" };
			return { status: "error", message: translateError(message) };
		}

		const unlock = await this.unlock(request.password);
		return unlock.status === "success" ? { status: "success" } : unlock;
	}

	@log("info")
	public async unlock(password: string): Promise<UnlockResult> {
		await this.bwServeModule.ensureStarted();
		try {
			await this.bwServeModule.request<BwMessage>("POST", "/unlock", { password });
		} catch (error) {
			return { status: "error", message: translateError(errorMessage(error)) };
		}

		const salt = crypto.randomBytes(16);
		this.repromptVerifier = { salt, hash: crypto.scryptSync(password, salt, 32) };

		await this.loadSnapshot();
		return { status: "success" };
	}

	@log("info")
	public async lock() {
		this.clear();
		if (this.bwServeModule.isRunning) {
			await this.bwServeModule.request("POST", "/lock").catch((error: unknown) => this.logger.warn("Lock failed", errorMessage(error)));
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
		this.clear();
		await this.clipboardModule.clearIfOwned();
		await this.bwServeModule.stop();
	}

	public get isUnlocked() {
		return this.snapshot !== null;
	}

	private clear() {
		this.items.clear();
		this.snapshot = null;
		this.repromptVerifier = null;
		this.repromptValidUntil = 0;
	}

	// endregion

	// region Vault

	public async getSnapshot(): Promise<VaultSnapshot> {
		return this.snapshot ?? (await this.loadSnapshot());
	}

	@log("info")
	public async sync(): Promise<VaultSnapshot> {
		await this.bwServeModule.request<BwMessage>("POST", "/sync");
		return await this.loadSnapshot();
	}

	private async loadSnapshot(): Promise<VaultSnapshot> {
		const [items, folders, organizations, collections, status] = await Promise.all([
			this.bwServeModule.request<BwList<BwItem>>("GET", "/list/object/items"),
			this.bwServeModule.request<BwList<BwFolder>>("GET", "/list/object/folders"),
			this.bwServeModule.request<BwList<BwOrganization>>("GET", "/list/object/organizations"),
			this.bwServeModule.request<BwList<BwCollection>>("GET", "/list/object/collections"),
			this.bwServeModule.request<BwStatus>("GET", "/status"),
		]);

		const active = items.data.filter((item) => !item.deletedDate);
		this.items = new Map(active.map((item) => [item.id, item]));

		this.snapshot = {
			items: active.map(sanitizeItem),
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
		if (value === null) throw new BwError("Valeur introuvable");
		return value;
	}

	public async copy(itemId: string | null, ref: CopyRef) {
		if (ref.kind === "text") {
			await this.clipboardModule.copy(ref.value);
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

		if (value === null) throw new BwError("Valeur introuvable");
		await this.clipboardModule.copy(value);
	}

	public async getTotp(itemId: string): Promise<TotpCode> {
		const item = this.getItem(itemId);
		this.ensureRepromptSatisfied(item);

		const { data: code } = await this.bwServeModule.request<BwString>("GET", `/object/totp/${encodeURIComponent(itemId)}`);
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
		if (!this.repromptVerifier) return false;
		const hash = crypto.scryptSync(password, this.repromptVerifier.salt, 32);
		const valid = crypto.timingSafeEqual(hash, this.repromptVerifier.hash);
		if (valid) this.repromptValidUntil = Date.now() + REPROMPT_GRACE_MS;
		return valid;
	}

	public async generatePassword(length: number) {
		const safeLength = Math.min(Math.max(Math.trunc(length) || 20, 8), 128);
		const { data } = await this.bwServeModule.request<BwString>("GET", `/generate?length=${safeLength}&uppercase&lowercase&number&special`);
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
		const item = this.items.get(itemId);
		if (!item) throw new BwError(this.snapshot ? "Élément introuvable" : "Le coffre est verrouillé");
		return item;
	}

	private ensureRepromptSatisfied(item: BwItem) {
		if (item.reprompt === 1 && Date.now() > this.repromptValidUntil) {
			throw new BwError("REPROMPT_REQUIRED");
		}
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

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function isTwoFactorError(message: string) {
	// Non-interactive CLI: "Code is required." when the account has two-step login
	return /two[- ]?(step|factor)|provider|2fa|code is required/i.test(message);
}

function translateError(message: string) {
	if (/username or password is incorrect/i.test(message)) return "Adresse e-mail ou mot de passe incorrect";
	if (/decryption operation failed|invalid master password/i.test(message)) return "Mot de passe maître incorrect";
	if (/two[- ]?step token is invalid|invalid.*code/i.test(message)) return "Code de vérification invalide";
	if (/fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(message)) return "Serveur injoignable";
	if (/certificate|self[- ]signed|UNABLE_TO_VERIFY/i.test(message)) return "Certificat du serveur non reconnu : approuvez son autorité dans les paramètres";
	return message;
}
