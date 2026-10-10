import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { CertificateModule } from "../security/certificate.module";
import { log } from "@main/utils/logs.utils";
import { BwError, type BwMessage, type BwResponse, type BwStatus } from "./bw.types";
import type { TwoFactorMethod } from "@shared/types/vault.types";

const SSO_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Runs the official Bitwarden CLI (`@bitwarden/cli`) with the Electron binary in Node mode.
 *
 * Secrets go through environment variables of the child process (`--passwordenv`), never through its arguments.
 * Commands touching the CLI data file must not run while `bw serve` is up: see {@link BwServeModule}.
 */
@injectable()
export class BwCliModule extends LogModule {
	#bwPath: string | undefined;
	/** Pending SSO login, waiting for the browser */
	#ssoAbort: AbortController | null = null;

	public constructor(
		@inject(MainContextModule) private readonly mainContextModule: MainContextModule,
		@inject(CertificateModule) private readonly certificateModule: CertificateModule
	) {
		super("BwCliModule");
	}

	private get bwPath() {
		return (this.#bwPath ??= createRequire(__filename).resolve("@bitwarden/cli/build/bw.js"));
	}

	/**
	 * Environment of every CLI process: dedicated data folder, no prompt, Node mode for the Electron binary
	 */
	public getEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
		return {
			...process.env,
			ELECTRON_RUN_AS_NODE: "1",
			BITWARDENCLI_APPDATA_DIR: this.mainContextModule.bitwardenDataFolder,
			BW_NOINTERACTION: "true",
			...extra,
		};
	}

	/**
	 * Spawns a long-running CLI process (used for `bw serve`)
	 */
	public spawn(args: string[], extraEnv: Record<string, string> = {}, signal?: AbortSignal): ChildProcess {
		// Authorities approved in the application (private PKI, self-signed server)
		const trust = this.certificateModule.cliTrust();
		return spawn(process.execPath, [...trust.args, this.bwPath, ...args], {
			env: this.getEnv({ ...trust.env, ...extraEnv }),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
			signal,
		});
	}

	/**
	 * Runs a CLI command with `--response` and returns its parsed data
	 *
	 * @param options.interactive lets the CLI open the browser (SSO), it still has no terminal to prompt in
	 */
	public async run<T>(args: string[], extraEnv: Record<string, string> = {}, options: { interactive?: boolean; signal?: AbortSignal } = {}): Promise<T> {
		const child = options.interactive
			? this.spawn([...args, "--response"], { ...extraEnv, BW_NOINTERACTION: "false" }, options.signal)
			: this.spawn([...args, "--response", "--nointeraction"], extraEnv, options.signal);

		let stdout = "";
		let stderr = "";
		child.stdout!.on("data", (data: Buffer) => (stdout += data.toString("utf-8")));
		child.stderr!.on("data", (data: Buffer) => (stderr += data.toString("utf-8")));

		const code = await new Promise<number | null>((resolve, reject) => {
			child.once("error", reject);
			child.once("close", resolve);
		});

		// The CLI prints notices ("Could not find dir...") before the JSON response
		const line = stdout
			.split(/\r?\n/)
			.reverse()
			.find((l) => l.startsWith("{"));

		if (!line) {
			this.logger.error(`bw ${args[0]} exited with code ${code} without response`, stderr.slice(0, 500));
			throw new BwError(stderr.trim().split(/\r?\n/).at(-1) || `bw ${args[0]} failed (code ${code})`);
		}

		const response = JSON.parse(line) as BwResponse<T>;
		if (!response.success) {
			throw new BwError(response.message);
		}
		return response.data;
	}

	@log()
	public async status() {
		return (await this.run<BwStatus>(["status"])).template;
	}

	@log()
	public async configServer(serverUrl: string) {
		await this.run<BwMessage>(["config", "server", serverUrl]);
	}

	@log("info")
	public async login(email: string, password: string, twoFactor?: { method: TwoFactorMethod; code: string }) {
		const args = ["login", email, "--passwordenv", "BW_LOGIN_PASSWORD"];
		if (twoFactor) {
			// Without code, the e-mail method only asks the server to send one
			args.push("--method", String(twoFactor.method));
			if (twoFactor.code) args.push("--code", twoFactor.code);
		}
		await this.run<BwMessage>(args, { BW_LOGIN_PASSWORD: password });
	}

	/**
	 * Single sign-on: the CLI opens the web vault in the browser and waits for the authorization code on localhost (PKCE).
	 * The vault is still decrypted with the master password afterwards.
	 */
	@log("info")
	public async loginSso() {
		const abort = new AbortController();
		this.#ssoAbort = abort;
		const timeout = setTimeout(() => abort.abort(), SSO_TIMEOUT_MS);
		try {
			await this.run<BwMessage>(["login", "--sso"], {}, { interactive: true, signal: abort.signal });
		} finally {
			clearTimeout(timeout);
			this.#ssoAbort = null;
		}
	}

	/**
	 * Stops a pending SSO login (the user gave up in the browser)
	 */
	public cancelSso() {
		this.#ssoAbort?.abort();
	}

	@log("info")
	public async logout() {
		await this.run<BwMessage>(["logout"]);
	}
}
