import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { CertificateModule } from "../security/certificate.module";
import { log } from "@main/utils/logs.utils";
import { BwError, type BwMessage, type BwResponse, type BwStatus } from "./bw.types";
import type { TwoFactorMethod } from "@shared/types/vault.types";

/**
 * Runs the official Bitwarden CLI (`@bitwarden/cli`) with the Electron binary in Node mode.
 *
 * Secrets go through environment variables of the child process (`--passwordenv`), never through its arguments.
 * Commands touching the CLI data file must not run while `bw serve` is up: see {@link BwServeModule}.
 */
@injectable()
export class BwCliModule extends LogModule {
	#bwPath: string | undefined;

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
		const extraCaCerts = this.certificateModule.extraCaCertsPath;
		return {
			...process.env,
			// Authorities approved in the application (private PKI, self-signed server)
			...(extraCaCerts ? { NODE_EXTRA_CA_CERTS: extraCaCerts } : {}),
			ELECTRON_RUN_AS_NODE: "1",
			BITWARDENCLI_APPDATA_DIR: this.mainContextModule.bitwardenDataFolder,
			BW_NOINTERACTION: "true",
			...extra,
		};
	}

	/**
	 * Spawns a long-running CLI process (used for `bw serve`)
	 */
	public spawn(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
		return spawn(process.execPath, [this.bwPath, ...args], {
			env: this.getEnv(extraEnv),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
	}

	/**
	 * Runs a CLI command with `--response` and returns its parsed data
	 */
	public async run<T>(args: string[], extraEnv: Record<string, string> = {}): Promise<T> {
		const child = this.spawn([...args, "--response", "--nointeraction"], extraEnv);

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

	@log("info")
	public async logout() {
		await this.run<BwMessage>(["logout"]);
	}
}
