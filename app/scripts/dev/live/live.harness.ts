// Helpers of the opt-in live write tests: a real Vaultwarden driven through `bw serve` (see docs/development/local-test-server.md).
// Each session has its own CLI data dir, so two sessions behave like two devices logged into the same account.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net, { type AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { BwFolder, BwItem, BwList, BwResponse } from "@main/modules/bitwarden/bw.types";
import { CipherType, type IdentityKey, type ItemDraft } from "@shared/types/vault.types";

export const LIVE_DOC = "docs/development/local-test-server.md";

/** Live tests spawn the CLI and talk to a real server: hooks need more than the 10 s default */
export const LIVE_HOOK_TIMEOUT = 120_000;

const devDir = path.resolve(import.meta.dirname, "..");
const bwPath = createRequire(import.meta.url).resolve("@bitwarden/cli/build/bw.js");

export type DevVault = { serverUrl: string; email: string; password: string };

/**
 * Loads scripts/dev/dev-vault.env and checks that the local server answers.
 * Fails with a pointer to the doc when the environment or the server is not ready.
 */
export async function prepareLiveServer(): Promise<DevVault> {
	process.loadEnvFile(path.join(devDir, "dev-vault.env"));

	const serverUrl = process.env.DEV_VAULT_SERVER;
	const email = process.env.DEV_VAULT_EMAIL;
	const password = process.env.DEV_VAULT_PASSWORD;
	if (!serverUrl || !email || !password) throw new Error(`scripts/dev/dev-vault.env is incomplete, see ${LIVE_DOC} (Live write tests)`);

	const caPath = process.env.NODE_EXTRA_CA_CERTS;
	if (!caPath) {
		throw new Error(`NODE_EXTRA_CA_CERTS is not set. Run: NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm test:live (see ${LIVE_DOC}, "Live write tests")`);
	}
	// The CLI runs from the same working directory, but an absolute path removes any doubt
	process.env.NODE_EXTRA_CA_CERTS = path.resolve(caPath);

	try {
		await fetch(new URL("/alive", serverUrl));
	} catch (error) {
		throw new Error(`The local Vaultwarden is not reachable at ${serverUrl}. Start it as described in ${LIVE_DOC} (Live write tests).`, { cause: error });
	}

	return { serverUrl, email, password };
}

/** Runs a `bw` command with the JSON response mode and returns its data */
function bwSync<T>(env: NodeJS.ProcessEnv, ...args: string[]): T {
	const result = spawnSync(process.execPath, [bwPath, ...args, "--response", "--nointeraction"], { env, encoding: "utf8" });
	const line = result.stdout.split("\n").find((candidate) => candidate.startsWith("{"));
	const response: BwResponse<T> = line ? JSON.parse(line) : { success: false, message: result.stderr };
	if (!response.success) throw new Error(`bw ${args[0]}: ${response.message}`);
	return response.data;
}

/** Free TCP port on 127.0.0.1 */
function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as AddressInfo;
			server.close(() => resolve(port));
		});
	});
}

/** A logged-in CLI with its own data dir and a running `bw serve` */
export class BwSession {
	private child: ChildProcess | null = null;

	private constructor(
		private readonly port: number,
		private readonly dataDir: string,
		child: ChildProcess
	) {
		this.child = child;
	}

	/** Logs the CLI into the account in a new data dir, then starts `bw serve` on a free port */
	static async open(vault: DevVault): Promise<BwSession> {
		const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "elyvault-live-"));
		const env = { ...process.env, BITWARDENCLI_APPDATA_DIR: dataDir, BW_PASSWORD: vault.password };

		let started: BwSession | undefined;
		try {
			bwSync(env, "config", "server", vault.serverUrl);
			const session = bwSync<{ raw: string }>(env, "login", vault.email, "--passwordenv", "BW_PASSWORD").raw;

			const port = await freePort();
			const child = spawn(process.execPath, [bwPath, "serve", "--hostname", "127.0.0.1", "--port", String(port)], {
				env: { ...env, BW_SESSION: session },
				stdio: "ignore",
			});
			started = new BwSession(port, dataDir, child);
			await started.waitReady();
			return started;
		} catch (error) {
			await started?.stop();
			fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
			throw error;
		}
	}

	private async waitReady(): Promise<void> {
		for (let attempt = 0; attempt < 150; attempt++) {
			if (this.child && this.child.exitCode !== null) throw new Error("bw serve exited before it was ready");
			try {
				await this.send("GET", "/status");
				return;
			} catch {
				await new Promise<void>((resolve) => setTimeout(resolve, 200));
			}
		}
		throw new Error("bw serve did not answer on 127.0.0.1 within 30 seconds");
	}

	/** Raw answer of `bw serve`: failures come back as `{ success: false, message }` with HTTP 400 */
	async send<T = unknown>(method: string, route: string, body?: unknown): Promise<BwResponse<T>> {
		const response = await fetch(`http://127.0.0.1:${this.port}${route}`, {
			method,
			headers: { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		return (await response.json()) as BwResponse<T>;
	}

	/** Like {@link send} but throws the CLI message on failure */
	async request<T = unknown>(method: string, route: string, body?: unknown): Promise<T> {
		const response = await this.send<T>(method, route, body);
		if (!response.success) throw new Error(response.message);
		return response.data;
	}

	/**
	 * Reads a route until `ready` accepts the data. `bw serve` writes its local cache asynchronously: a read right after
	 * a write can still show the previous state (observed with CLI 2026.9.1). Gives up after about 5 seconds and returns
	 * the last answer, so the assertions that follow report the real state.
	 */
	async read<T>(route: string, ready: (data: T) => boolean = () => true): Promise<T> {
		let response = await this.send<T>("GET", route);
		for (let attempt = 0; attempt < 25; attempt++) {
			if (response.success && ready(response.data)) break;
			await new Promise<void>((resolve) => setTimeout(resolve, 200));
			response = await this.send<T>("GET", route);
		}
		if (!response.success) throw new Error(response.message);
		return response.data;
	}

	get(id: string, ready?: (item: BwItem) => boolean): Promise<BwItem> {
		return this.read<BwItem>(`/object/item/${id}`, ready);
	}

	/** Ids of the active items, or of the trash when `trash` is true */
	async itemIds(trash = false, ready?: (ids: string[]) => boolean): Promise<string[]> {
		const list = await this.read<BwList<BwItem>>(`/list/object/items${trash ? "?trash=true" : ""}`, (data) => ready?.(data.data.map((item) => item.id)) ?? true);
		return list.data.map((item) => item.id);
	}

	/** Folders as the CLI lists them, the virtual "No folder" entry included */
	async folders(ready?: (folders: BwFolder[]) => boolean): Promise<BwFolder[]> {
		return (await this.read<BwList<BwFolder>>("/list/object/folders", (data) => ready?.(data.data) ?? true)).data;
	}

	/** Stops `bw serve` and deletes the CLI data dir */
	async stop(): Promise<void> {
		const child = this.child;
		this.child = null;
		if (child && child.exitCode === null) {
			const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
			child.kill();
			await exited;
		}
		fs.rmSync(this.dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
}

/** Draft of an item as the editor shows it before any change: secrets are absent, which means unchanged */
export function draftFromItem(item: BwItem): ItemDraft {
	return {
		type: item.type as CipherType,
		name: item.name,
		notes: item.notes ?? null,
		favorite: item.favorite,
		reprompt: item.reprompt === 1,
		folderId: item.folderId,
		fields: (item.fields ?? []).map((field, index) => ({
			originalIndex: index,
			name: field.name ?? "",
			type: field.type,
			...(field.type === 1 ? {} : { value: field.value }),
		})),
		login: item.login && {
			username: item.login.username,
			uris: (item.login.uris ?? []).map((uri) => ({ uri: uri.uri ?? "", match: uri.match ?? null })),
		},
		card: item.card && {
			cardholderName: item.card.cardholderName,
			brand: item.card.brand,
			expMonth: item.card.expMonth,
			expYear: item.card.expYear,
		},
		identity: item.identity as Record<IdentityKey, string | null> | undefined,
	};
}
