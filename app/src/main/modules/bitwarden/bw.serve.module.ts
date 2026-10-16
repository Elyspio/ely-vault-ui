import type { ChildProcess } from "node:child_process";
import net from "node:net";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { BwCliModule } from "./bw.cli.module";
import { log } from "@main/utils/logs.utils";
import { BwError, type BwResponse } from "./bw.types";

/**
 * Lifecycle of the `bw serve` REST API, bound to 127.0.0.1 on a random port.
 *
 * `bw serve` has no authentication: once unlocked, any local process reaching the port can read the vault.
 * Mitigations: loopback only, random port, requests with an Origin header refused by the CLI (no browser CSRF),
 * vault locked as soon as possible (auto-lock, system lock, quit). Only the main process talks to it.
 */
@injectable()
export class BwServeModule extends LogModule {
	private process: ChildProcess | null = null;
	private port: number | null = null;
	private starting: Promise<void> | null = null;
	private readonly exitListeners: (() => void)[] = [];

	public constructor(@inject(BwCliModule) private readonly bwCliModule: BwCliModule) {
		super("BwServeModule");
	}

	/** Called when the server exits without being stopped (e.g. a CLI crash) */
	public onUnexpectedExit(listener: () => void) {
		this.exitListeners.push(listener);
	}

	public get isRunning() {
		return this.process !== null;
	}

	/**
	 * Starts the server if needed and waits until it answers
	 */
	public async ensureStarted() {
		if (this.process && this.port) return;
		this.starting ??= this.start().finally(() => {
			this.starting = null;
		});
		await this.starting;
	}

	@log("info")
	private async start() {
		const port = await getFreePort();
		const child = this.bwCliModule.spawn(["serve", "--hostname", "127.0.0.1", "--port", String(port)]);

		child.stderr!.on("data", (data: Buffer) => this.logger.warn("bw serve stderr", data.toString("utf-8").slice(0, 300)));
		child.once("exit", (code, signal) => {
			this.logger.info("bw serve exited", { code, signal });
			if (this.process === child) {
				this.process = null;
				this.port = null;
				for (const listener of this.exitListeners) listener();
			}
		});

		this.process = child;
		this.port = port;

		for (let attempt = 0; attempt < 100; attempt++) {
			if (!this.process) throw new BwError("The Bitwarden CLI server stopped while starting");
			try {
				await this.request("GET", "/status");
				return;
			} catch (error) {
				if (error instanceof BwError) return;
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		await this.stop();
		throw new BwError("The Bitwarden CLI server did not start");
	}

	/**
	 * Locks the vault and stops the server. Needed before CLI commands that write the CLI data file (login, logout, config).
	 */
	@log("info")
	public async stop() {
		const child = this.process;
		if (!child) return;

		await this.request("POST", "/lock").catch(() => undefined);

		// Cleared first: the exit that follows is expected
		this.process = null;
		this.port = null;
		const exited = new Promise((resolve) => child.once("exit", resolve));
		child.kill();
		await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
	}

	/**
	 * Calls the API and unwraps its envelope; an unsuccessful answer throws a {@link BwError}
	 */
	public async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", route: string, body?: unknown): Promise<T> {
		if (!this.port) throw new BwError("The Bitwarden CLI server is not running");

		const init: RequestInit = { method };
		if (body !== undefined) {
			init.headers = { "Content-Type": "application/json" };
			init.body = JSON.stringify(body);
		}
		const response = await fetch(`http://127.0.0.1:${this.port}${route}`, init);

		// Unhandled CLI errors answer a plain "Internal Server Error"
		const text = await response.text();
		let json: BwResponse<T>;
		try {
			json = JSON.parse(text) as BwResponse<T>;
		} catch {
			throw new BwError(`bw serve ${route}: HTTP ${response.status} ${text.slice(0, 200)}`);
		}
		if (!json.success) throw new BwError(json.message);
		return json.data;
	}
}

function getFreePort() {
	return new Promise<number>((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as net.AddressInfo;
			server.close(() => resolve(port));
		});
	});
}
