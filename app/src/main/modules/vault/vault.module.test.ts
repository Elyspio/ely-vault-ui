import { describe, expect, it, vi } from "vite-plus/test";
import { VaultModule } from "./vault.module";
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

// The Electron APIs do not exist outside the application: the module only uses `net` at runtime, not in these tests
vi.mock("electron", () => ({
	net: { fetch: vi.fn() },
	app: { getPath: vi.fn(() => "") },
}));

// Logs go to winston and the app folder: the module only needs a logger object here
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
			this.lastSync = this.nextTime();
			return message();
		}

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
};

/** Module on top of the fake server, locked. `seed` runs after the default seed and before the unlock */
async function setup(seed?: (serve: FakeBwServe) => void): Promise<Harness> {
	const serve = new FakeBwServe();
	seedVault(serve);
	seed?.(serve);

	const clipboard = { copy: vi.fn(async () => undefined), clearIfOwned: vi.fn(async () => undefined) };
	const ipc = { sendToMainWindow: vi.fn() };
	const sshKeys = new SshKeyModule();
	const module = new VaultModule(
		{} as unknown as BwCliModule,
		serve as unknown as BwServeModule,
		clipboard as unknown as ClipboardModule,
		ipc as unknown as IpcModule,
		{} as unknown as CertificateModule,
		sshKeys
	);
	return { module, serve, clipboard, ipc, sshKeys };
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

			expect(result.outcome).toEqual({ status: "error", message: "The name is required" });
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

			expect(result.outcome).toEqual({ status: "error", message: "The name is required" });
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

			expect(result.outcome).toEqual({ status: "error", message: "The SSH key expired, generate or import it again" });
			expect(serve.callsTo("POST", "/object/item")).toHaveLength(0);
		});

		it("refuses an SSH key item created without any key", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createItem(newSshKeyDraft("Deploy"));

			expect(result.outcome).toEqual({ status: "error", message: "An SSH key is required: generate, import or paste one" });
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

			await expect(pending).rejects.toThrow("The vault is locked");
			expect(module.isUnlocked).toBe(false);
		});

		it("discards a snapshot loaded for a session that was locked while reading", async () => {
			const { module, serve } = await unlockedSetup();
			const gate = serve.hold("GET", "/list/object/items");

			const pending = module.sync();
			await vi.waitFor(() => expect(serve.calls.filter((call) => call.route === "/list/object/items")).toHaveLength(1));
			await module.lock();
			gate.open();

			await expect(pending).rejects.toThrow("The vault is locked");
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

			expect(result.outcome).toEqual({ status: "error", message: "Item not found in the trash" });
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

			expect(result.outcome).toEqual({ status: "error", message: "No item selected" });
			expect(serve.writes()).toHaveLength(0);
		});

		it("refuses the whole selection when one id is not in the trash, without deleting anything", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.purgeItems(["trash-1", "plain-1"]);

			expect(result.outcome).toEqual({ status: "error", message: "Item not found in the trash" });
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

			expect(result.outcome).toEqual({ status: "error", message: "Folder not found" });
			expect(serve.writes()).toHaveLength(0);
		});
	});

	describe("folders", () => {
		it("refuses a folder whose normalized name already exists", async () => {
			const { module, serve } = await unlockedSetup();

			const result = await module.createFolder("  Work / ");

			expect(result.outcome).toEqual({ status: "error", message: "A folder with this name already exists" });
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

			expect((await module.createFolder(" / ")).outcome).toEqual({ status: "error", message: "The folder name is empty" });
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

			expect(result.outcome).toEqual({ status: "error", message: "Move or delete its items first" });
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

			expect(result.outcome).toEqual({ status: "error", message: "Delete its sub folders first" });
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

			await expect(module.getSecret("trash-2", { kind: "password" })).rejects.toThrow("Item not found");
			await expect(module.copy("trash-2", { kind: "password" })).rejects.toThrow("Item not found");
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
