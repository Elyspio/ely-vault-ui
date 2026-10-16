import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OfflineAccessModule, OFFLINE_ACCESS_MS, VAULT_SYNC_INTERVAL_MS } from "./offline-access.module";
import type { MainContextModule } from "../context/main.context.module";
import { VaultModule, isAuthenticationRejection } from "./vault.module";
import type { BwCollection, BwFolder, BwItem, BwMessage, BwOrganization } from "../bitwarden/bw.types";
import { BwError } from "../bitwarden/bw.types";
import type { BwCliModule } from "../bitwarden/bw.cli.module";
import type { BwServeModule } from "../bitwarden/bw.serve.module";
import type { ClipboardModule } from "../security/clipboard.module";
import type { IpcModule } from "../ipc.module";
import type { CertificateModule } from "../security/certificate.module";
import { CipherType, FieldType, type ItemDraft } from "@shared/types/vault.types";
import { SshKeyModule } from "./ssh.key.module";
import loginFixture from "./fixtures/login-passkey.json";
import { appMessage } from "@shared/i18n/message";
import type { I18nModule } from "../i18n/i18n.module";
import type { ConfigModule } from "../config/config.module";
import { defaultAppConfig, offlineAccessMs } from "@shared/config/app.config";

/** Configuration with the given offline access window (default 24 hours) */
function configWith(offlineAccessMinutes = defaultAppConfig.security.offlineAccessMinutes) {
	return { getConfig: async () => ({ ...defaultAppConfig, security: { ...defaultAppConfig.security, offlineAccessMinutes } }) } as unknown as ConfigModule;
}

/** Native dialog texts: their key is enough here */
const i18n = { t: async (key: string) => key } as unknown as I18nModule;

// The Electron APIs do not exist outside the application: the module only uses `net` at runtime, not in these tests
vi.mock("electron", () => ({
	net: { fetch: vi.fn() },
	app: { getPath: vi.fn(() => "") },
}));

// Logs go to winston and the app folder: the module only needs a logger object here
// Native dialog texts come from the configuration: not needed here
vi.mock("../i18n/i18n.module", () => ({ I18nModule: class {} }));

vi.mock("../log.module", () => ({
	LogModule: class {
		public logger = {
			info: () => undefined,
			debug: () => undefined,
			warn: () => undefined,
			error: () => undefined,
		};
	},
}));

// Injected collaborators: imported at runtime for their DI tokens only, their behaviour is faked per test
vi.mock("../bitwarden/bw.cli.module", () => ({ BwCliModule: class {} }));
vi.mock("../bitwarden/bw.serve.module", () => ({ BwServeModule: class {} }));
vi.mock("../security/clipboard.module", () => ({ ClipboardModule: class {} }));
vi.mock("../ipc.module", () => ({ IpcModule: class {} }));
vi.mock("../security/certificate.module", () => ({ CertificateModule: class {} }));
vi.mock("../context/main.context.module", () => ({ MainContextModule: class {} }));
vi.mock("../config/config.module", () => ({ ConfigModule: class {} }));

const PASSWORD = "pw";
const SERVER = "https://vault.example";
const EMAIL = "me@example.com";
const BASE_TIME = Date.UTC(2026, 9, 11, 10);

/** Item of the login fixture (master password reprompt enabled, passkey, linked field) */
const REPROMPTED_ID = "6f1c2a0e-1b2c-4d3e-8f90-112233445566";
const REPROMPTED_REVISION = "2026-10-01T08:00:00.000Z";
const PLAIN_REVISION = "2026-10-02T08:00:00.000Z";

const SECRETS = ["hunter2-password", "plain-secret", "JBSWY3DPEHPK3PXP", "a1b2-c3d4", "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0w"];

type Call = { method: string; route: string; body: unknown };
type Gate = { promise: Promise<void>; open: () => void };
type Hook = { method: string; route: string; once: boolean; fail?: string; gate?: Gate };

/** Full item as `bw serve` returns it, built from the fixture */
function rawItem(overrides: Partial<BwItem>): BwItem {
	return { ...(structuredClone(loginFixture) as BwItem), ...overrides };
}

/** Personal login without passkey, no reprompt, not in a folder */
function plainItem(id: string, overrides: Partial<BwItem> = {}): BwItem {
	return rawItem({
		id,
		name: id,
		reprompt: 0,
		favorite: false,
		folderId: null,
		notes: null,
		fields: [],
		revisionDate: PLAIN_REVISION,
		deletedDate: null,
		archivedDate: null,
		login: {
			username: "alice",
			password: "plain-secret",
			totp: null,
			uris: [{ uri: "https://plain.example", match: null }],
			passwordRevisionDate: null,
			fido2Credentials: [],
		},
		...overrides,
	});
}

/** Draft the renderer would send for an item, without any secret change */
function draftOf(original: BwItem, overrides: Partial<ItemDraft> = {}): ItemDraft {
	return {
		type: original.type as CipherType,
		name: original.name,
		notes: original.notes ?? null,
		favorite: original.favorite,
		reprompt: original.reprompt === 1,
		folderId: original.folderId,
		fields: (original.fields ?? []).map((field, index) => ({
			originalIndex: index,
			name: field.name ?? "",
			type: field.type as FieldType,
			...(field.type === FieldType.Hidden ? {} : { value: field.value }),
		})),
		login: {
			username: original.login?.username ?? null,
			uris: (original.login?.uris ?? []).map((uri) => ({ uri: uri.uri ?? "", match: uri.match ?? null })),
		},
		...overrides,
	};
}

function newLoginDraft(name: string): ItemDraft {
	return { type: CipherType.Login, name, notes: null, favorite: false, reprompt: false, folderId: null, fields: [], login: { username: "bob", uris: [] } };
}

function newSshKeyDraft(name: string, sshKey?: { token: string }): ItemDraft {
	return { type: CipherType.SshKey, name, notes: null, favorite: false, reprompt: false, folderId: null, fields: [], sshKey };
}

function list<T>(data: T[]) {
	return { object: "list" as const, data: structuredClone(data) };
}

function message(): BwMessage {
	return { object: "message", title: "", message: null };
}

/**
 * In-memory fake of the routes of `bw serve` used by the vault module.
 *
 * It records every call, can fail or hold a route (gate) and refuses reads while locked, like the CLI.
 */
class FakeBwServe {
	public readonly calls: Call[] = [];
	public readonly items = new Map<string, BwItem>();
	/** Remote changes with an unchanged account revision are fetched only by a forced sync. */
	public readonly remoteItems = new Map<string, BwItem>();
	public folders: BwFolder[] = [];
	public status: "locked" | "unlocked" = "locked";
	public isRunning = true;
	public readonly ensureStarted = vi.fn(async () => undefined);
	public readonly stop = vi.fn(async () => undefined);
	private readonly hooks: Hook[] = [];
	private clock = 0;
	private created = 0;
	private lastSync: string | null = null;
	private staleItems: { count: number; items: BwItem[] } | null = null;

	/** The next active item lists answer the current items, like the CLI cache right after a write */
	public serveStaleLists(count: number) {
		this.staleItems = { count, items: [...this.items.values()].map((item) => structuredClone(item)) };
	}

	/** Next request of this route fails with the message */
	public failOnce(method: string, route: string, message: string) {
		this.hooks.push({ method, route, once: true, fail: message });
	}

	/** Holds the request of this route until the gate opens, then serves it */
	public hold(method: string, route: string): Gate {
		let open!: () => void;
		const promise = new Promise<void>((resolve) => {
			open = resolve;
		});
		this.hooks.push({ method, route, once: true, gate: { promise, open } });
		return { promise, open };
	}

	public clearCalls() {
		this.calls.length = 0;
	}

	public callsTo(method: string, path: string) {
		return this.calls.filter((call) => call.method === method && call.route.split("?")[0] === path);
	}

	public writes() {
		return this.calls.filter((call) => call.method !== "GET");
	}

	public request = async (method: string, route: string, body?: unknown): Promise<unknown> => {
		this.calls.push({ method, route, body: structuredClone(body) });
		const path = route.split("?")[0];

		if (this.status === "locked" && !["/status", "/unlock", "/lock"].includes(path)) throw new BwError("Vault is locked.");

		const index = this.hooks.findIndex((hook) => hook.method === method && hook.route === route);
		if (index >= 0) {
			const hook = this.hooks[index];
			if (hook.once) this.hooks.splice(index, 1);
			if (hook.gate) await hook.gate.promise;
			if (hook.fail) throw new BwError(hook.fail);
		}

		return this.handle(method, route, body);
	};

	private nextTime() {
		this.clock++;
		return new Date(BASE_TIME + this.clock * 1000).toISOString();
	}

	private handle(method: string, route: string, body: unknown): unknown {
		const [path, query = ""] = route.split("?");
		const params = new URLSearchParams(query);
		const payload = (body ?? {}) as Record<string, unknown>;

		if (method === "GET" && path === "/status") {
			return { object: "template", template: { serverUrl: SERVER, lastSync: this.lastSync, userEmail: EMAIL, status: this.status } };
		}
		if (method === "POST" && path === "/unlock") {
			if (payload.password !== PASSWORD) throw new BwError("Invalid master password.");
			this.status = "unlocked";
			return message();
		}
		if (method === "POST" && path === "/lock") {
			this.status = "locked";
			return message();
		}
		if (method === "POST" && path === "/sync") {
			if (params.get("force") === "true") {
				for (const [id, item] of this.remoteItems) this.items.set(id, structuredClone(item));
			}
			this.lastSync = this.nextTime();
			return message();
		}
		if (method === "GET" && path.startsWith("/object/totp/")) return { object: "string", data: "123456" };

		if (method === "GET" && path === "/list/object/items") {
			const trash = params.get("trash") === "true";
			const archived = params.get("archived") === "true";
			if (!trash && !archived && this.staleItems && this.staleItems.count-- > 0) return list(this.staleItems.items.filter((item) => !item.deletedDate && !item.archivedDate));
			return list([...this.items.values()].filter((item) => Boolean(item.deletedDate) === trash && Boolean(item.archivedDate) === archived));
		}
		if (method === "GET" && path === "/list/object/folders") return list(this.folders);
		if (method === "GET" && path === "/list/object/organizations") return list<BwOrganization>([]);
		if (method === "GET" && path === "/list/object/collections") return list<BwCollection>([]);

		if (method === "POST" && path === "/object/item") {
			const id = `new-${++this.created}`;
			const item = { ...(structuredClone(body) as BwItem), id, revisionDate: this.nextTime(), deletedDate: null, archivedDate: null };
			this.items.set(id, item);
			return structuredClone(item);
		}

		const itemId = /^\/object\/item\/([^/]+)$/.exec(path)?.[1];
		if (itemId !== undefined) {
			const existing = this.items.get(itemId);
			if (!existing) throw new BwError("Not found.");
			if (method === "GET") return structuredClone(existing);
			if (method === "PUT") {
				if (existing.deletedDate) throw new BwError("You may not edit a deleted item");
				const item = { ...(structuredClone(body) as BwItem), id: itemId, revisionDate: this.nextTime() };
				this.items.set(itemId, item);
				return structuredClone(item);
			}
			if (method === "DELETE") {
				if (params.get("permanent") === "true") this.items.delete(itemId);
				else this.items.set(itemId, { ...existing, deletedDate: this.nextTime() });
				return message();
			}
		}

		const restoreId = /^\/restore\/item\/([^/]+)$/.exec(path)?.[1];
		if (method === "POST" && restoreId !== undefined) {
			const existing = this.items.get(restoreId);
			if (!existing) throw new BwError("Not found.");
			this.items.set(restoreId, { ...existing, deletedDate: null });
			return structuredClone(this.items.get(restoreId));
		}

		if (method === "POST" && path === "/object/folder") {
			const folder = { id: `f-new-${++this.created}`, name: String(payload.name) };
			this.folders.push(folder);
			return { ...folder };
		}
		const folderId = /^\/object\/folder\/([^/]+)$/.exec(path)?.[1];
		if (folderId !== undefined) {
			const existing = this.folders.find((folder) => folder.id === folderId);
			if (!existing) throw new BwError("Not found.");
			if (method === "PUT") {
				existing.name = String(payload.name);
				return { ...existing };
			}
			if (method === "DELETE") {
				this.folders = this.folders.filter((folder) => folder.id !== folderId);
				return message();
			}
		}

		throw new Error(`Unhandled fake route: ${method} ${route}`);
	}
}

const FOLDERS: BwFolder[] = [
	{ id: null, name: "No folder" },
	{ id: "f-work", name: "Work" },
	{ id: "f-proj", name: "Work/Projects" },
	{ id: "f-deep", name: "Work/Projects/2026" },
	{ id: "f-personal", name: "Personal" },
];

/** Seeded vault: one reprompted login, two personal logins, three trashed items (one of them archived) */
function seedVault(serve: FakeBwServe) {
	serve.folders = structuredClone(FOLDERS);
	for (const item of [
		rawItem({ folderId: "f-work" }),
		plainItem("plain-1"),
		plainItem("plain-2"),
		plainItem("trash-1", { deletedDate: "2026-10-09T08:00:00.000Z", folderId: "f-personal" }),
		plainItem("trash-2", { deletedDate: "2026-10-09T08:00:00.000Z", archivedDate: "2026-10-05T08:00:00.000Z" }),
		plainItem("trash-3", { deletedDate: "2026-10-09T08:00:00.000Z" }),
	]) {
		serve.items.set(item.id, item);
	}
}

type Harness = {
	module: VaultModule;
	serve: FakeBwServe;
	clipboard: { copy: ReturnType<typeof vi.fn>; clearIfOwned: ReturnType<typeof vi.fn> };
	ipc: { sendToMainWindow: ReturnType<typeof vi.fn> };
	sshKeys: SshKeyModule;
	access: OfflineAccessModule;
	folder: string;
};

const harnesses: Harness[] = [];
afterEach(async () => {
	for (const harness of harnesses.splice(0)) {
		await harness.module.shutdown();
		fs.rmSync(harness.folder, { recursive: true, force: true });
	}
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Module on top of the fake server, locked. `seed` runs after the default seed and before the unlock */
async function setup(seed?: (serve: FakeBwServe) => void): Promise<Harness> {
	const serve = new FakeBwServe();
	seedVault(serve);
	seed?.(serve);

	const clipboard = { copy: vi.fn(async () => undefined), clearIfOwned: vi.fn(async () => undefined) };
	const ipc = { sendToMainWindow: vi.fn() };
	const sshKeys = new SshKeyModule(i18n);
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "elyvault-access-test-"));
	const access = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith());
	const module = new VaultModule(
		{} as unknown as BwCliModule,
		serve as unknown as BwServeModule,
		clipboard as unknown as ClipboardModule,
		ipc as unknown as IpcModule,
		{} as unknown as CertificateModule,
		sshKeys,
		access
	);
	const harness = { module, serve, clipboard, ipc, sshKeys, access, folder };
	harnesses.push(harness);
	return harness;
}

/** Module unlocked like the real flow: the snapshot is loaded by unlock */
async function unlockedSetup(seed?: (serve: FakeBwServe) => void): Promise<Harness> {
	const harness = await setup(seed);
	expect(await harness.module.unlock(PASSWORD)).toEqual({ status: "success" });
	harness.serve.clearCalls();
	return harness;
}

function putRoutes(serve: FakeBwServe) {
	return serve.calls.filter((call) => call.method === "PUT").map((call) => call.route);
}

describe("VaultModule unlock", () => {
	it("fetches remote changes after unlock even when the account revision has not advanced", async () => {
		const { module, serve } = await setup();
		serve.remoteItems.set("remote-item", plainItem("remote-item"));
		expect(await module.unlock(PASSWORD)).toEqual({ status: "success" });
		expect((await module.getSnapshot()).items.some((item) => item.id === "remote-item")).toBe(true);
	});

	it("syncs after unlocking and before loading the snapshot", async () => {
		const { module, serve } = await setup();
		const gate = serve.hold("POST", "/sync?force=true");
		const pending = module.unlock(PASSWORD);
		await vi.waitFor(() => expect(serve.callsTo("POST", "/sync")).toHaveLength(1));
		expect(serve.callsTo("POST", "/unlock")).toHaveLength(1);
		expect(serve.callsTo("GET", "/list/object/items")).toHaveLength(0);
		serve.items.set("remote-item", plainItem("remote-item"));
		gate.open();
		expect(await pending).toEqual({ status: "success" });
		const snapshot = await module.getSnapshot();
		expect(snapshot.items.some((item) => item.id === "remote-item")).toBe(true);
		expect(snapshot.lastSync).not.toBeNull();
	});

	it("loads cached items when the sync fails", async () => {
		const { module, serve } = await unlockedSetup();
		await module.lock();
		serve.failOnce("POST", "/sync?force=true", "Server unreachable.");
		expect(await module.unlock(PASSWORD)).toEqual({ status: "success" });
		expect(module.isUnlocked).toBe(true);
		expect((await module.getSnapshot()).items.some((item) => item.id === "plain-1")).toBe(true);
	});

	it("does not sync when the password is invalid", async () => {
		const { module, serve } = await setup();
		expect(await module.unlock("wrong-password")).toMatchObject({ status: "error" });
		expect(serve.callsTo("POST", "/sync")).toHaveLength(0);
		expect(module.isUnlocked).toBe(false);
	});

	it("discards an unlock snapshot when locked during sync", async () => {
		const { module, serve } = await setup();
		const gate = serve.hold("POST", "/sync?force=true");
		const pending = module.unlock(PASSWORD);
		const rejected = expect(pending).rejects.toBeDefined();
		await vi.waitFor(() => expect(serve.callsTo("POST", "/sync")).toHaveLength(1));
		await module.lock();
		gate.open();
		await rejected;
		expect(module.isUnlocked).toBe(false);
		expect(module.verifyReprompt(PASSWORD)).toBe(false);
	});
});

describe("24-hour offline vault access", () => {
	it("refuses an offline unlock without ElyVault verification, retaining the encrypted cache", async () => {
		const { module, serve } = await setup();
		serve.failOnce("POST", "/sync?force=true", "Server unreachable.");
		expect(await module.unlock(PASSWORD)).toEqual({ status: "error", message: appMessage("vaultOfflineExpired") });
		expect(module.isUnlocked).toBe(false);
		expect(serve.status).toBe("locked");
		expect(serve.callsTo("GET", "/list/object/items")).toHaveLength(0);
		expect(serve.items.has("plain-1")).toBe(true);
	});

	it("expires at exactly 24 hours and accepts a successful online recovery", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve } = await unlockedSetup();
		await module.lock();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		serve.failOnce("POST", "/sync?force=true", "fetch failed");
		expect(await module.unlock(PASSWORD)).toEqual({ status: "error", message: appMessage("vaultOfflineExpired") });
		expect(await module.unlock(PASSWORD)).toEqual({ status: "success" });
		expect(module.isUnlocked).toBe(true);
	});

	it("locks an open session, clears held keys and the clipboard, and reports the recovery reason", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, clipboard, ipc, sshKeys, serve } = await unlockedSetup();
		const key = sshKeys.generate();
		await module.copy("plain-1", { kind: "password" });
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		await vi.advanceTimersByTimeAsync(1000);
		expect(module.isUnlocked).toBe(false);
		expect(serve.status).toBe("locked");
		expect(sshKeys.peek(key.token)).toBeNull();
		expect(clipboard.clearIfOwned).toHaveBeenCalled();
		expect(ipc.sendToMainWindow).toHaveBeenCalledWith("session:state", expect.objectContaining({ status: "locked", accessBlock: "offline-expired" }));
		expect(module.verifyReprompt(PASSWORD)).toBe(false);
	});

	it("blocks secret operations and writes before the expiry timer runs", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve, clipboard } = await unlockedSetup();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		expect(() => module.getProtectedItem("plain-1")).toThrow(appMessage("vaultOfflineExpired"));
		await expect(module.getSecret("plain-1", { kind: "password" })).rejects.toThrow(appMessage("vaultOfflineExpired"));
		await expect(module.copy(null, { kind: "text", value: "cached value" })).rejects.toThrow(appMessage("vaultOfflineExpired"));
		await expect(module.getSnapshot()).rejects.toThrow(appMessage("vaultOfflineExpired"));
		await expect(module.createFolder("Blocked")).rejects.toThrow(appMessage("vaultOfflineExpired"));
		expect(clipboard.copy).not.toHaveBeenCalled();
		expect(serve.callsTo("POST", "/object/folder")).toHaveLength(0);
	});

	it("does not renew access after network failure, even when the CLI has a lastSync timestamp", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve, folder } = await unlockedSetup();
		const before = fs.readFileSync(path.join(folder, "offline-access.json"), "utf8");
		vi.setSystemTime(BASE_TIME + 60_000);
		serve.failOnce("POST", "/sync?force=true", "HTTP 503 Service Unavailable");
		await expect(module.sync()).rejects.toThrow("503");
		expect(module.isUnlocked).toBe(true);
		expect(fs.readFileSync(path.join(folder, "offline-access.json"), "utf8")).toBe(before);
	});

	it.each(["HTTP 401 Unauthorized", 'Syncing failed: {"statusCode":403}', "Syncing failed: invalid_grant", "Syncing failed: Stamp has changed"])(
		"immediately blocks authentication rejection: %s",
		async (error) => {
			const { module, serve, access } = await unlockedSetup();
			serve.failOnce("POST", "/sync?force=true", error);
			await expect(module.sync()).rejects.toThrow(appMessage("vaultAuthenticationRequired"));
			expect(module.isUnlocked).toBe(false);
			expect(access.block).toBe("authentication-required");
			expect(await module.unlock(PASSWORD)).toEqual({ status: "error", message: appMessage("vaultAuthenticationRequired") });
		}
	);

	it("returns an authentication recovery error when rejected during unlock", async () => {
		const { module, serve } = await unlockedSetup();
		await module.lock();
		serve.failOnce("POST", "/sync?force=true", "Unauthorized");
		expect(await module.unlock(PASSWORD)).toEqual({ status: "error", message: appMessage("vaultAuthenticationRequired") });
	});

	it("syncs every 15 minutes while unlocked and stops the schedule on lock", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve, ipc } = await unlockedSetup();
		serve.remoteItems.set("remote-item", plainItem("remote-item"));
		await vi.advanceTimersByTimeAsync(VAULT_SYNC_INTERVAL_MS);
		expect(serve.callsTo("POST", "/sync")).toHaveLength(1);
		expect(ipc.sendToMainWindow).toHaveBeenCalledWith(
			"vault:snapshot",
			expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ id: "remote-item" })]) })
		);
		await module.lock();
		await vi.advanceTimersByTimeAsync(VAULT_SYNC_INTERVAL_MS);
		expect(serve.callsTo("POST", "/sync")).toHaveLength(1);
	});

	it("checks expiry before a resume sync", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve } = await unlockedSetup();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		await module.refreshAccess();
		expect(module.isUnlocked).toBe(false);
		expect(serve.callsTo("POST", "/sync")).toHaveLength(0);
	});

	it("locks when refreshed permissions cannot be loaded", async () => {
		const { module, serve } = await unlockedSetup();
		serve.failOnce("GET", "/list/object/items", "Read failed");
		await expect(module.sync()).rejects.toThrow("Read failed");
		expect(module.isUnlocked).toBe(false);
		await expect(module.getSecret("plain-1", { kind: "password" })).rejects.toThrow(appMessage("vaultLocked"));
	});

	it("does not renew or publish an in-flight sync after expiry", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, serve, access, ipc } = await unlockedSetup();
		const gate = serve.hold("POST", "/sync?force=true");
		const pending = module.refreshAccess();
		await Promise.resolve();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		await vi.advanceTimersByTimeAsync(1000);
		gate.open();
		await pending;
		expect(access.block).toBe("offline-expired");
		expect(module.isUnlocked).toBe(false);
		expect(ipc.sendToMainWindow.mock.calls.some(([channel]) => channel === "vault:snapshot")).toBe(false);
	});

	it("renews the deadline after a successful sync", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { module, access } = await unlockedSetup();
		vi.setSystemTime(BASE_TIME + 12 * 60 * 60_000);
		await module.sync();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		expect(module.isUnlocked).toBe(true);
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS + 12 * 60 * 60_000);
		expect(access.block).toBe("offline-expired");
	});

	it("discards a secret computed while locking", async () => {
		const { module, serve } = await unlockedSetup();
		const gate = serve.hold("GET", "/object/totp/plain-1");
		const pending = module.getTotp("plain-1");
		const rejected = expect(pending).rejects.toThrow(appMessage("vaultLocked"));
		await module.lock();
		gate.open();
		await rejected;
	});
});

describe("persisted offline access evidence", () => {
	const status = { serverUrl: SERVER, userEmail: EMAIL, lastSync: null, status: "locked" as const };

	it("keeps the original deadline across restarts and isolates accounts and hosts", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { access, folder } = await setup();
		access.select(status);
		access.verified();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS - 1);
		const restarted = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith());
		restarted.select(status);
		expect(restarted.block).toBeUndefined();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		expect(restarted.block).toBe("offline-expired");
		restarted.select({ ...status, serverUrl: "https://another.example" });
		expect(restarted.block).toBe("offline-expired");
		restarted.select({ ...status, userEmail: "another@example.com" });
		expect(restarted.block).toBe("offline-expired");
	});

	it("persists rejection across restarts and requires login followed by sync", async () => {
		const { access, folder } = await setup();
		access.select(status);
		access.verified();
		access.reject();
		const restarted = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith());
		restarted.select(status);
		expect(restarted.block).toBe("authentication-required");
		expect(() => restarted.verified()).toThrow();
		restarted.authenticated();
		expect(restarted.block).toBe("offline-expired");
		restarted.verified();
		expect(restarted.block).toBeUndefined();
	});

	it("invalidates evidence on clock rollback, including after restart", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { access, folder } = await setup();
		access.select(status);
		access.verified();
		vi.setSystemTime(BASE_TIME + 120_000);
		access.observe();
		vi.setSystemTime(BASE_TIME + 60_000);
		const restarted = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith());
		restarted.select(status);
		expect(restarted.block).toBe("offline-expired");
		vi.setSystemTime(BASE_TIME + 180_000);
		expect(restarted.block).toBe("offline-expired");
		restarted.verified();
		expect(restarted.block).toBeUndefined();
	});

	it.each(["broken json", "null", "{}", '{"verifiedAt":"yesterday"}'])("refuses malformed evidence: %s", async (json) => {
		const { access, folder } = await setup();
		fs.writeFileSync(path.join(folder, "offline-access.json"), json);
		access.select(status);
		expect(access.block).toBe("offline-expired");
	});

	it("rejects future verification timestamps", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { access, folder } = await setup();
		access.select(status);
		access.verified();
		const file = path.join(folder, "offline-access.json");
		const record = JSON.parse(fs.readFileSync(file, "utf8"));
		fs.writeFileSync(file, JSON.stringify({ ...record, verifiedAt: BASE_TIME + 60_000, observedAt: BASE_TIME + 60_000 }));
		const restarted = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith());
		restarted.select(status);
		expect(restarted.block).toBe("offline-expired");
	});

	it("applies a shorter configured window, including to existing evidence", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { access, folder } = await setup();
		access.select(status);
		access.verified();
		const restarted = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith(1));
		await restarted.loadLimit();
		restarted.select(status);
		vi.setSystemTime(BASE_TIME + 59_999);
		expect(restarted.block).toBeUndefined();
		vi.setSystemTime(BASE_TIME + 60_000);
		expect(restarted.block).toBe("offline-expired");
	});

	it("applies a window changed in the settings to the current lease, within 24 hours", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { folder } = await setup();
		const config = { minutes: 60 };
		const configModule = { getConfig: async () => ({ ...defaultAppConfig, security: { ...defaultAppConfig.security, offlineAccessMinutes: config.minutes } }) };
		const access = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configModule as unknown as ConfigModule);
		await access.loadLimit();
		access.select(status);
		access.verified();
		vi.setSystemTime(BASE_TIME + 30 * 60_000);
		config.minutes = 24 * 60;
		await access.loadLimit();
		vi.setSystemTime(BASE_TIME + 2 * 60 * 60_000);
		expect(access.block).toBeUndefined();
		config.minutes = 90;
		await access.loadLimit();
		expect(access.block).toBe("offline-expired");
	});

	it("never extends the window beyond 24 hours", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(BASE_TIME);
		const { folder } = await setup();
		const access = new OfflineAccessModule({ appFolder: folder } as MainContextModule, configWith(7 * 24 * 60));
		await access.loadLimit();
		access.select(status);
		access.verified();
		vi.setSystemTime(BASE_TIME + OFFLINE_ACCESS_MS);
		expect(access.block).toBe("offline-expired");
	});

	it.each([
		[1, 60_000],
		[90, 90 * 60_000],
		[1440, OFFLINE_ACCESS_MS],
		[100_000, OFFLINE_ACCESS_MS],
		[0, 60_000],
		[-5, 60_000],
		[Number.NaN, OFFLINE_ACCESS_MS],
		["60", OFFLINE_ACCESS_MS],
		[undefined, OFFLINE_ACCESS_MS],
	])("caps the configured window: %s minutes", (minutes, expected) => {
		expect(offlineAccessMs(minutes)).toBe(expected);
	});

	it("fails closed when verification evidence cannot be written", async () => {
		const { access } = await setup();
		access.select(status);
		vi.spyOn(fs, "renameSync").mockImplementation(() => {
			throw new Error("Disk unavailable");
		});
		expect(() => access.verified()).toThrow("Disk unavailable");
		expect(access.block).toBe("offline-expired");
		expect(() => access.reject()).toThrow("Disk unavailable");
		expect(access.block).toBe("authentication-required");
	});

	it.each(["HTTP 503 Service Unavailable", "fetch failed", "ECONNREFUSED", "ETIMEDOUT", "certificate expired", "You do not have permission to edit this item"])(
		"does not classify an outage or item permission as authentication rejection: %s",
		(error) => {
			expect(isAuthenticationRejection(error)).toBe(false);
		}
	);
});

describe("VaultModule writes", () => {
	describe("updateItem", () => {
		it("sends the full item with the draft applied, keeping passkeys, history and linked fields", async () => {
			const { module, serve } = await unlockedSetup();
			const fixture = structuredClone(loginFixture);
			expect(module.verifyReprompt(PASSWORD)).toBe(true);

			const draft = draftOf(rawItem({ folderId: "f-work" }), {
				name: "GitHub work",
				favorite: true,
				reprompt: true,
				folderId: "f-work",
				fields: [
					{ originalIndex: 0, name: "Recovery code", type: FieldType.Hidden },
					{ originalIndex: 1, name: "Account", type: FieldType.Text, value: "octocat" },
					{ originalIndex: 2, name: "Username", type: FieldType.Linked },
				],
			});
			const result = await module.updateItem(REPROMPTED_ID, REPROMPTED_REVISION, draft);

			expect(result.outcome).toEqual({ status: "success", id: REPROMPTED_ID });
			const [put] = serve.callsTo("PUT", `/object/item/${REPROMPTED_ID}`);
			expect(put.body).toMatchObject({
				name: "GitHub work",
				favorite: true,
				reprompt: 1,
				folderId: "f-work",
				passwordHistory: fixture.passwordHistory,
				key: fixture.key,
				login: {
					username: "octocat",
					password: "hunter2-password",
					totp: "JBSWY3DPEHPK3PXP",
					fido2Credentials: fixture.login.fido2Credentials,
				},
			});
			expect(put.body).toMatchObject({
				fields: [
					{ name: "Recovery code", type: FieldType.Hidden, value: "a1b2-c3d4", linkedId: null },
					{ name: "Account", type: FieldType.Text, value: "octocat", linkedId: null },
					{ name: "Username", type: FieldType.Linked, value: null, linkedId: 100 },
				],
			});
			expect(result.snapshot?.items.find((item) => item.id === REPROMPTED_ID)?.name).toBe("GitHub work");
			expect(result.refreshError).toBeNull();
		});

		it("refuses a stale expected revision without writing", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.updateItem("plain-1", "2020-01-01T00:00:00.000Z", draftOf(plainItem("plain-1"), { name: "Renamed" }));

			expect(result.outcome).toEqual({ status: "conflict" });
			expect(serve.callsTo("PUT", "/object/item/plain-1")).toHaveLength(0);
		});

		it("syncs and reports a conflict when the server answers that the local copy is out of date", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("PUT", "/object/item/plain-1", "The client copy of this cipher is out of date. Resync the client and try again.");

			const result = await module.updateItem("plain-1", PLAIN_REVISION, draftOf(plainItem("plain-1"), { name: "Renamed" }));

			expect(result.outcome).toEqual({ status: "conflict" });
			expect(serve.callsTo("POST", "/sync")).toHaveLength(1);
			expect(result.snapshot).not.toBeNull();
		});

		it("reports other server errors as an error outcome", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("PUT", "/object/item/plain-1", "You do not have permission to edit this item");

			const result = await module.updateItem("plain-1", PLAIN_REVISION, draftOf(plainItem("plain-1"), { name: "Renamed" }));

			expect(result.outcome).toEqual({ status: "error", message: "You do not have permission to edit this item" });
			expect(serve.callsTo("POST", "/sync")).toHaveLength(0);
		});

		it("returns a validation error without writing when the name is empty", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.updateItem("plain-1", PLAIN_REVISION, draftOf(plainItem("plain-1"), { name: "   " }));

			expect(result.outcome).toEqual({ status: "error", message: appMessage("nameRequired") });
			expect(serve.callsTo("PUT", "/object/item/plain-1")).toHaveLength(0);
		});

		it("throws REPROMPT_REQUIRED for a reprompt item until the master password is checked again", async () => {
			const { module, serve } = await unlockedSetup();
			const draft = draftOf(rawItem({ folderId: "f-work" }), { name: "GitHub work" });

			await expect(module.updateItem(REPROMPTED_ID, REPROMPTED_REVISION, draft)).rejects.toThrow("REPROMPT_REQUIRED");
			expect(serve.writes()).toHaveLength(0);

			expect(module.verifyReprompt("wrong")).toBe(false);
			await expect(module.updateItem(REPROMPTED_ID, REPROMPTED_REVISION, draft)).rejects.toThrow("REPROMPT_REQUIRED");

			expect(module.verifyReprompt(PASSWORD)).toBe(true);
			const result = await module.updateItem(REPROMPTED_ID, REPROMPTED_REVISION, draft);
			expect(result.outcome).toEqual({ status: "success", id: REPROMPTED_ID });
		});
	});

	describe("createItem", () => {
		it("creates a personal item and returns its id", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createItem(newLoginDraft("New account"));

			expect(result.outcome).toEqual({ status: "success", id: "new-1" });
			const [post] = serve.callsTo("POST", "/object/item");
			expect(post.body).toMatchObject({ name: "New account", type: CipherType.Login, organizationId: null, login: { username: "bob" } });
			expect(result.snapshot?.items.map((item) => item.id)).toContain("new-1");
		});

		it("returns a validation error without creating anything when the name is empty", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createItem(newLoginDraft(""));

			expect(result.outcome).toEqual({ status: "error", message: appMessage("nameRequired") });
			expect(serve.callsTo("POST", "/object/item")).toHaveLength(0);
		});

		it("creates an SSH key item with the held key, and forgets the key once saved", async () => {
			const { module, serve, sshKeys } = await unlockedSetup();
			const key = sshKeys.generate();

			const result = await module.createItem(newSshKeyDraft("Deploy", { token: key.token }));

			expect(result.outcome).toEqual({ status: "success", id: "new-1" });
			const [post] = serve.callsTo("POST", "/object/item");
			expect(post.body).toMatchObject({ type: CipherType.SshKey, sshKey: { publicKey: key.publicKey, keyFingerprint: key.keyFingerprint } });
			expect((post.body as { sshKey: { privateKey: string } }).sshKey.privateKey).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----/);
			expect(sshKeys.peek(key.token)).toBeNull();
		});

		it("refuses an SSH key item whose key is no longer held, without creating anything", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createItem(newSshKeyDraft("Deploy", { token: "unknown" }));

			expect(result.outcome).toEqual({ status: "error", message: appMessage("sshKeyExpired") });
			expect(serve.callsTo("POST", "/object/item")).toHaveLength(0);
		});

		it("refuses an SSH key item created without any key", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createItem(newSshKeyDraft("Deploy"));

			expect(result.outcome).toEqual({ status: "error", message: appMessage("sshKeyRequired") });
			expect(serve.callsTo("POST", "/object/item")).toHaveLength(0);
		});
	});

	describe("session changes during a write", () => {
		it("rejects a save finished after the vault was locked, and does not publish a session", async () => {
			const { module, serve } = await unlockedSetup();
			const gate = serve.hold("PUT", "/object/item/plain-1");

			const pending = module.updateItem("plain-1", PLAIN_REVISION, draftOf(plainItem("plain-1"), { name: "Renamed" }));
			await vi.waitFor(() => expect(putRoutes(serve)).toEqual(["/object/item/plain-1"]));
			await module.lock();
			gate.open();

			await expect(pending).rejects.toThrow(appMessage("vaultLocked"));
			expect(module.isUnlocked).toBe(false);
		});

		it("discards a snapshot loaded for a session that was locked while reading", async () => {
			const { module, serve } = await unlockedSetup();
			const gate = serve.hold("GET", "/list/object/items");

			const pending = module.sync();
			await vi.waitFor(() => expect(serve.calls.filter((call) => call.route === "/list/object/items")).toHaveLength(1));
			await module.lock();
			gate.open();

			await expect(pending).rejects.toThrow(appMessage("vaultLocked"));
			expect(module.isUnlocked).toBe(false);
		});

		it("runs two writes one after the other, the second one starts when the first one is done", async () => {
			const { module, serve } = await unlockedSetup();
			const gate = serve.hold("PUT", "/object/item/plain-1");

			const first = module.updateItem("plain-1", PLAIN_REVISION, draftOf(plainItem("plain-1"), { name: "First" }));
			const second = module.updateItem("plain-2", PLAIN_REVISION, draftOf(plainItem("plain-2"), { name: "Second" }));
			await vi.waitFor(() => expect(putRoutes(serve)).toEqual(["/object/item/plain-1"]));
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(putRoutes(serve)).toEqual(["/object/item/plain-1"]);
			expect(serve.callsTo("GET", "/object/item/plain-2")).toHaveLength(0);

			gate.open();
			expect((await first).outcome).toEqual({ status: "success", id: "plain-1" });
			expect((await second).outcome).toEqual({ status: "success", id: "plain-2" });
			expect(putRoutes(serve)).toEqual(["/object/item/plain-1", "/object/item/plain-2"]);
		});

		it("keeps running the next write when a write failed", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("DELETE", "/object/item/plain-1", "boom");

			const [failed, succeeded] = await Promise.all([module.deleteItem("plain-1"), module.setFavorite("plain-2", true)]);

			expect(failed.outcome).toEqual({ status: "error", message: "boom" });
			expect(succeeded.outcome).toEqual({ status: "success", id: "plain-2" });
		});

		it("reloads until the CLI cache shows the write", async () => {
			const { module, serve } = await unlockedSetup();
			serve.serveStaleLists(2);
			serve.clearCalls();

			const result = await module.setFavorite("plain-1", true);

			expect(result.snapshot?.items.find((item) => item.id === "plain-1")?.favorite).toBe(true);
			expect(serve.callsTo("GET", "/list/object/items").filter((call) => !call.route.includes("?"))).toHaveLength(3);
		});

		it("returns the outcome without a snapshot when reloading the vault fails afterwards", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("GET", "/list/object/items", "server gone");

			const result = await module.setFavorite("plain-1", true);

			expect(result.outcome).toEqual({ status: "success", id: "plain-1" });
			expect(result.snapshot).toBeNull();
			expect(result.refreshError).toBe("server gone");
			expect(serve.callsTo("PUT", "/object/item/plain-1")).toHaveLength(1);
		});
	});

	describe("deleteItem", () => {
		it("moves an item to the trash and lists it in the snapshot trash", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.deleteItem("plain-1");

			expect(result.outcome).toEqual({ status: "success", id: "plain-1" });
			expect(serve.callsTo("DELETE", "/object/item/plain-1")).toHaveLength(1);
			expect(result.snapshot?.items.map((item) => item.id)).not.toContain("plain-1");
			expect(result.snapshot?.trash.find((item) => item.id === "plain-1")?.deletedDate).not.toBeNull();
		});

		it("throws REPROMPT_REQUIRED for a reprompt item without deleting it", async () => {
			const { module, serve } = await unlockedSetup();

			await expect(module.deleteItem(REPROMPTED_ID)).rejects.toThrow("REPROMPT_REQUIRED");
			expect(serve.writes()).toHaveLength(0);

			module.verifyReprompt(PASSWORD);
			expect((await module.deleteItem(REPROMPTED_ID)).outcome).toEqual({ status: "success", id: REPROMPTED_ID });
		});

		it("refuses an item that is already in the trash", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.deleteItem("trash-1");

			expect(result.outcome.status).toBe("error");
			expect(serve.callsTo("DELETE", "/object/item/trash-1")).toHaveLength(0);
		});
	});

	describe("restoreItem", () => {
		it("refuses an id that is not in the trash", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.restoreItem("plain-1");

			expect(result.outcome).toEqual({ status: "error", message: appMessage("itemNotInTrash") });
			expect(serve.callsTo("POST", "/restore/item/plain-1")).toHaveLength(0);
		});

		it("restores a trashed item, including an archived one", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.restoreItem("trash-1");

			expect(result.outcome).toEqual({ status: "success", id: "trash-1" });
			expect(serve.callsTo("POST", "/restore/item/trash-1")).toHaveLength(1);
			expect(result.snapshot?.items.map((item) => item.id)).toContain("trash-1");
		});
	});

	describe("purgeItems", () => {
		it("refuses an empty selection", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.purgeItems([]);

			expect(result.outcome).toEqual({ status: "error", message: appMessage("noItemSelected") });
			expect(serve.writes()).toHaveLength(0);
		});

		it("refuses the whole selection when one id is not in the trash, without deleting anything", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.purgeItems(["trash-1", "plain-1"]);

			expect(result.outcome).toEqual({ status: "error", message: appMessage("itemNotInTrash") });
			expect(serve.writes()).toHaveLength(0);
		});

		it("permanently deletes the selected trashed items", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.purgeItems(["trash-1", "trash-3"]);

			expect(result.outcome).toEqual({ status: "success", id: null, done: ["trash-1", "trash-3"] });
			expect(serve.callsTo("DELETE", "/object/item/trash-1")).toHaveLength(1);
			expect(serve.calls.map((call) => call.route)).toContain("/object/item/trash-3?permanent=true");
			expect(result.snapshot?.trash.map((item) => item.id)).toEqual(["trash-2"]);
		});

		it("stops at the first failure and reports what was done", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("DELETE", "/object/item/trash-2?permanent=true", "locked cipher");

			const result = await module.purgeItems(["trash-1", "trash-2", "trash-3"]);

			expect(result.outcome).toEqual({ status: "partial", done: ["trash-1"], failed: { id: "trash-2", message: "locked cipher" } });
			expect(serve.calls.map((call) => call.route)).not.toContain("/object/item/trash-3?permanent=true");
			expect(result.snapshot?.trash.map((item) => item.id).sort()).toEqual(["trash-2", "trash-3"]);
		});

		it("throws REPROMPT_REQUIRED before deleting any item of the selection", async () => {
			const { module, serve } = await unlockedSetup((seeded) => {
				seeded.items.get("trash-2")!.reprompt = 1;
			});

			await expect(module.purgeItems(["trash-1", "trash-2"])).rejects.toThrow("REPROMPT_REQUIRED");
			expect(serve.writes()).toHaveLength(0);
		});
	});

	describe("favorite and folder of an item", () => {
		it("sets the favorite flag on the full fresh item", async () => {
			const { module, serve } = await unlockedSetup();
			const before = structuredClone(serve.items.get("plain-1"));

			const result = await module.setFavorite("plain-1", true);

			expect(result.outcome).toEqual({ status: "success", id: "plain-1" });
			expect(serve.callsTo("PUT", "/object/item/plain-1")[0].body).toEqual({ ...before, favorite: true });
		});

		it("does not ask for the master password to set a favorite on a reprompt item", async () => {
			const { module } = await unlockedSetup();

			const result = await module.setFavorite(REPROMPTED_ID, false);

			expect(result.outcome).toEqual({ status: "success", id: REPROMPTED_ID });
		});

		it("moves an item to a folder, changing only the folder", async () => {
			const { module, serve } = await unlockedSetup();
			const before = structuredClone(serve.items.get("plain-1"));

			const result = await module.moveItem("plain-1", "f-personal");

			expect(result.outcome).toEqual({ status: "success", id: "plain-1" });
			expect(serve.callsTo("PUT", "/object/item/plain-1")[0].body).toEqual({ ...before, folderId: "f-personal" });
			expect(result.snapshot?.items.find((item) => item.id === "plain-1")?.folderId).toBe("f-personal");
		});

		it("moves an item out of its folder", async () => {
			const { module, serve } = await unlockedSetup();

			await module.moveItem(REPROMPTED_ID, null);

			expect(serve.callsTo("PUT", `/object/item/${REPROMPTED_ID}`)[0].body).toMatchObject({ folderId: null });
		});

		it("refuses an unknown folder without writing", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.moveItem("plain-1", "f-unknown");

			expect(result.outcome).toEqual({ status: "error", message: appMessage("folderNotFound") });
			expect(serve.writes()).toHaveLength(0);
		});
	});

	describe("folders", () => {
		it("refuses a folder whose normalized name already exists", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createFolder("  Work / ");

			expect(result.outcome).toEqual({ status: "error", message: appMessage("folderExists") });
			expect(serve.writes()).toHaveLength(0);
		});

		it("creates a folder with its normalized path", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createFolder("Clients/ Acme ");

			expect(result.outcome).toEqual({ status: "success", id: "f-new-1" });
			expect(serve.callsTo("POST", "/object/folder")[0].body).toEqual({ name: "Clients/Acme" });
		});

		it("refuses an empty folder name", async () => {
			const { module, serve } = await unlockedSetup();

			expect((await module.createFolder(" / ")).outcome).toEqual({ status: "error", message: appMessage("folderNameEmpty") });
			expect(serve.writes()).toHaveLength(0);
		});

		it("renames a folder and its sub folders, parents first", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.renameFolder("Work", "Job");

			expect(result.outcome).toMatchObject({ status: "success", id: null });
			expect(serve.calls.filter((call) => call.method === "PUT").map((call) => [call.route, call.body])).toEqual([
				["/object/folder/f-work", { name: "Job" }],
				["/object/folder/f-proj", { name: "Job/Projects" }],
				["/object/folder/f-deep", { name: "Job/Projects/2026" }],
			]);
			expect(result.snapshot?.folders.map((folder) => folder.name)).toEqual(["Job", "Job/Projects", "Job/Projects/2026", "Personal"]);
		});

		it("stops a rename cascade at the first failure", async () => {
			const { module, serve } = await unlockedSetup();
			serve.failOnce("PUT", "/object/folder/f-proj", "nope");

			const result = await module.renameFolder("Work", "Job");

			expect(result.outcome).toEqual({ status: "partial", done: ["f-work"], failed: { id: "f-proj", message: "nope" } });
			expect(serve.callsTo("PUT", "/object/folder/f-deep")).toHaveLength(0);
		});

		it("refuses a rename onto an existing folder without writing", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.renameFolder("Work", "Personal");

			expect(result.outcome).toEqual({ status: "error", message: 'A folder named "Personal" already exists' });
			expect(serve.writes()).toHaveLength(0);
		});

		it("refuses to delete a folder that holds an active item", async () => {
			const { module, serve } = await unlockedSetup();
			await module.moveItem("plain-1", "f-personal");
			serve.clearCalls();

			const result = await module.deleteFolder("f-personal");

			expect(result.outcome).toEqual({ status: "error", message: appMessage("folderHasItems") });
			expect(serve.callsTo("DELETE", "/object/folder/f-personal")).toHaveLength(0);
		});

		it("deletes a folder whose only items are in the trash", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.deleteFolder("f-personal");

			expect(result.outcome).toEqual({ status: "success", id: "f-personal" });
			expect(serve.callsTo("DELETE", "/object/folder/f-personal")).toHaveLength(1);
		});

		it("refuses to delete a folder that has sub folders", async () => {
			const { module, serve } = await unlockedSetup();

			// f-work also holds an active item, so the sub folder check is tested on f-proj (holds only "2026")
			const result = await module.deleteFolder("f-proj");

			expect(result.outcome).toEqual({ status: "error", message: appMessage("folderHasSubFolders") });
			expect(serve.writes()).toHaveLength(0);
		});
	});

	describe("trash in the snapshot", () => {
		it("lists deleted items, archived ones included, only in the trash", async () => {
			const { module } = await unlockedSetup();

			const snapshot = await module.getSnapshot();

			expect(snapshot.items.map((item) => item.id).sort()).toEqual([REPROMPTED_ID, "plain-1", "plain-2"].sort());
			expect(snapshot.trash.map((item) => item.id).sort()).toEqual(["trash-1", "trash-2", "trash-3"]);
			expect(snapshot.trash.every((item) => item.deletedDate !== null)).toBe(true);
		});

		it("refuses to read or copy a secret of a trashed item", async () => {
			const { module, clipboard } = await unlockedSetup();

			await expect(module.getSecret("trash-2", { kind: "password" })).rejects.toThrow(appMessage("itemNotFound"));
			await expect(module.copy("trash-2", { kind: "password" })).rejects.toThrow(appMessage("itemNotFound"));
			expect(clipboard.copy).not.toHaveBeenCalled();
		});
	});

	describe("secrets", () => {
		it("never returns or logs a password, a TOTP seed, a hidden value or a passkey key", async () => {
			const { module, serve } = await unlockedSetup();
			const logged: unknown[] = [];
			for (const level of ["info", "debug", "warn", "error"] as const) {
				vi.spyOn(module.logger, level).mockImplementation((...args: unknown[]) => {
					logged.push(args);
				});
			}
			expect(module.verifyReprompt(PASSWORD)).toBe(true);

			const results = [
				await module.updateItem(
					REPROMPTED_ID,
					REPROMPTED_REVISION,
					draftOf(rawItem({ folderId: "f-work" }), {
						login: { username: "octocat", uris: [], password: { kind: "set", value: "brand-new-secret" } },
					})
				),
				await module.createItem({ ...newLoginDraft("With secret"), login: { username: "bob", uris: [], password: { kind: "set", value: "fresh-created-secret" } } }),
				await module.setFavorite("plain-1", true),
				await module.moveItem("plain-1", "f-personal"),
				await module.purgeItems(["trash-3"]),
			];

			const serialized = JSON.stringify([results, logged]);
			for (const secret of [...SECRETS, "brand-new-secret", "fresh-created-secret"]) {
				expect(serialized).not.toContain(secret);
			}
			expect(serve.calls.some((call) => call.body !== undefined && JSON.stringify(call.body).includes("brand-new-secret"))).toBe(true);
		});
	});
});
