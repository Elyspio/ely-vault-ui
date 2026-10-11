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

/** How long a successful master password reprompt unlocks protected items */
const REPROMPT_GRACE_MS = 5 * 60 * 1000;

/** `bw serve` answers a write before its local cache shows it: the reload is retried until the change appears */
const SETTLE_ATTEMPTS = 10;
const SETTLE_DELAY_MS = 150;

/** Shown when the SSH key of a draft is no longer held (expired, or the vault was locked) */
const SSH_KEY_EXPIRED = "The SSH key expired, generate or import it again";

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

	public constructor(
		@inject(BwCliModule) private readonly bwCliModule: BwCliModule,
		@inject(BwServeModule) private readonly bwServeModule: BwServeModule,
		@inject(ClipboardModule) private readonly clipboardModule: ClipboardModule,
		@inject(IpcModule) private readonly ipcModule: IpcModule,
		@inject(CertificateModule) private readonly certificateModule: CertificateModule,
		@inject(SshKeyModule) private readonly sshKeyModule: SshKeyModule
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
		if (!serverUrl) return { status: "error", message: "Invalid server address (https:// required)" };

		// The CLI only says "certificate error": check first, so the user can review and approve the certificate
		const certificate = await this.certificateModule.check(serverUrl);
		if (certificate.status === "untrusted") return { status: "untrusted-certificate", certificate: certificate.certificate };
		if (certificate.status === "unreachable") return { status: "error", message: `Server unreachable: ${certificate.message}` };

		// Login, logout and server config write the CLI data file: the server must be down
		await this.bwServeModule.stop();
		this.clear();

		try {
			const status = await this.bwCliModule.status();
			if (status.status !== "unauthenticated") await this.bwCliModule.logout();
			if (status.serverUrl !== serverUrl) await this.bwCliModule.configServer(serverUrl);

			if (request.sso) await this.bwCliModule.loginSso();
			else await this.bwCliModule.login(request.email.trim(), request.password, request.twoFactor);
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") return { status: "error", message: "SSO login cancelled or expired" };
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
		return this.snapshot ?? (await this.loadSnapshot());
	}

	@log("info")
	public async sync(): Promise<VaultSnapshot> {
		return this.enqueue(async () => {
			const generation = this.generation;
			await this.bwServeModule.request<BwMessage>("POST", "/sync");
			return await this.loadSnapshot(generation);
		});
	}

	/**
	 * Reads the vault from `bw serve`. Nothing is published when the session changed while reading (lock)
	 */
	private async loadSnapshot(generation = this.generation): Promise<VaultSnapshot> {
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

		if (value === null) throw new BwError("Value not found");
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
		const item = this.items.get(itemId);
		if (!item) throw new BwError(this.snapshot ? "Item not found" : "The vault is locked");
		return item;
	}

	private ensureRepromptSatisfied(item: BwItem) {
		if (item.reprompt === 1 && Date.now() > this.repromptValidUntil) {
			throw new BwError("REPROMPT_REQUIRED");
		}
	}

	private ensureGeneration(generation: number) {
		if (generation !== this.generation) throw new BwError("The vault is locked");
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
			const generation = this.generation;
			let outcome: WriteOutcome;
			try {
				outcome = await task();
			} catch (error) {
				// Locked during the write: the CLI error says so in its own words
				this.ensureGeneration(generation);
				const message = errorMessage(error);
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
					await this.bwServeModule.request<BwMessage>("POST", "/sync");
					snapshot = await this.loadSnapshot(generation);
				}
				return { outcome, snapshot, refreshError: null };
			} catch (error) {
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
					await this.bwServeModule.request<BwMessage>("POST", "/sync");
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
			if (!this.trash.has(itemId)) return { status: "error", message: "Item not found in the trash" };

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
				if (ids.length === 0) return { status: "error", message: "No item selected" };
				if (ids.some((id) => !this.trash.has(id))) return { status: "error", message: "Item not found in the trash" };
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
				if (folderId !== null && !this.folders.some((folder) => folder.id === folderId)) return { status: "error", message: "Folder not found" };

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
			if (segments.length === 0) return { status: "error", message: "The folder name is empty" };

			const normalized = joinFolderSegments(segments);
			const exists = this.folders.some((folder) => folder.id !== null && joinFolderSegments(folderSegments(folder.name)) === normalized);
			if (exists) return { status: "error", message: "A folder with this name already exists" };

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
	return message === "REPROMPT_REQUIRED" || message === "The vault is locked";
}

function isTwoFactorError(message: string) {
	// Non-interactive CLI: "Code is required." when the account has two-step login
	return /two[- ]?(step|factor)|provider|2fa|code is required/i.test(message);
}

function translateError(message: string) {
	if (/username or password is incorrect/i.test(message)) return "Incorrect email address or password";
	if (/decryption operation failed|invalid master password/i.test(message)) return "Incorrect master password";
	if (/two[- ]?step token is invalid|invalid.*code/i.test(message)) return "Invalid verification code";
	if (/fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(message)) return "Server unreachable";
	if (/certificate|self[- ]signed|UNABLE_TO_VERIFY/i.test(message)) return "Server certificate not recognized: approve its authority in the settings";
	return message;
}
