import path from "node:path";
import * as fs from "node:fs";
import { safeStorage } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { VaultModule } from "../vault/vault.module";
import { WindowModule } from "../window/window.module";
import { type HelloVerification, isHelloAvailable, requestHelloVerification } from "./windows.hello";
import type { AccountInfo, HelloUnlockResult, HelloUnlockStatus, UnlockResult } from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";

/**
 * Windows Hello choice of one account: the master password encrypted with the Windows user's key (DPAPI, Electron
 * safeStorage) when enabled, no password when the user declined it (it is not offered again)
 */
type StoredUnlock = {
	serverUrl: string | null;
	email: string | null;
	password?: string;
};

/** How long after a master password unlock Windows Hello can be enabled without typing the password again */
const OFFER_MS = 5 * 60_000;

const verificationErrors: Record<Exclude<HelloVerification, "verified" | "canceled">, string> = {
	unavailable: "Windows Hello is not available",
	busy: "Windows Hello is busy, try again",
	"retries-exhausted": "Too many Windows Hello attempts",
};

/**
 * Unlocks the vault with Windows Hello (face, fingerprint or PIN).
 *
 * The master password is stored encrypted for the Windows user (DPAPI) and only decrypted after a Windows Hello
 * verification. It is offered after the first master password unlock of an account. The choice is forgotten on logout,
 * and when the stored password no longer unlocks the vault (master password changed): Windows Hello is offered again.
 */
@injectable()
export class HelloUnlockModule extends LogModule {
	private verifying = false;
	/** Master password of the last unlock (encrypted), to enable Windows Hello when the user accepts the offer */
	private offer: { password: Buffer; expiresAt: number } | null = null;

	public constructor(
		@inject(MainContextModule) private readonly mainContextModule: MainContextModule,
		@inject(VaultModule) private readonly vaultModule: VaultModule,
		@inject(WindowModule) private readonly windowModule: WindowModule
	) {
		super("HelloUnlockModule");
	}

	private get storePath() {
		return path.join(this.mainContextModule.appFolder, "hello-unlock.json");
	}

	public async getStatus(): Promise<HelloUnlockStatus> {
		const available = await this.isAvailable();
		return { available, enabled: available && this.read(await this.vaultModule.getState())?.password !== undefined };
	}

	/**
	 * Keeps the master password of a successful unlock for a few minutes, when Windows Hello can be offered for this account
	 */
	public async rememberOffer(password: string) {
		this.offer = null;
		if (this.read(await this.vaultModule.getState()) || !(await this.isAvailable())) return;
		this.offer = { password: safeStorage.encryptString(password), expiresAt: Date.now() + OFFER_MS };
	}

	/**
	 * Whether to offer Windows Hello now: available, never enabled nor declined for this account, right after a master password unlock
	 */
	public hasOffer() {
		if (this.offer && (this.offer.expiresAt < Date.now() || !this.vaultModule.isUnlocked)) this.offer = null;
		return this.offer !== null;
	}

	/**
	 * The user declined Windows Hello: it is no longer offered for this account (still available in the settings)
	 */
	public async declineOffer() {
		this.offer = null;
		await this.disable();
	}

	/**
	 * Enables Windows Hello for the unlocked account, once the master password is confirmed and Windows Hello verified.
	 * Without password, the one of the unlock offering Windows Hello is used.
	 */
	public async enable(password: string | null): Promise<HelloUnlockResult> {
		if (!this.vaultModule.isUnlocked) return { status: "error", message: appMessage("unlockFirst") };
		if (password === null) {
			if (!this.hasOffer()) return { status: "error", message: appMessage("enableHelloFromSettings") };
			password = safeStorage.decryptString(this.offer!.password);
		}
		if (!this.vaultModule.checkMasterPassword(password)) return { status: "error", message: appMessage("incorrectMasterPassword") };
		if (!(await this.isAvailable())) return { status: "error", message: verificationErrors.unavailable };

		const verification = await this.verify("Enable Windows Hello to unlock ElyVault");
		if (verification.status !== "success") return verification;

		const { serverUrl, email } = await this.vaultModule.getState();
		const stored: StoredUnlock = { serverUrl, email, password: safeStorage.encryptString(password).toString("base64") };
		await fs.promises.writeFile(this.storePath, JSON.stringify(stored), { mode: 0o600 });
		this.offer = null;
		this.logger.info("Windows Hello unlock enabled");
		return { status: "success" };
	}

	/**
	 * Turns Windows Hello off for the current account: the password is removed, and Windows Hello is not offered again
	 */
	public async disable() {
		const { serverUrl, email } = await this.vaultModule.getState();
		const declined: StoredUnlock = { serverUrl, email };
		await fs.promises.writeFile(this.storePath, JSON.stringify(declined), { mode: 0o600 });
	}

	/**
	 * Forgets the account's choice, on logout
	 */
	public async forget() {
		this.offer = null;
		await fs.promises.rm(this.storePath, { force: true });
	}

	public async unlock(): Promise<HelloUnlockResult> {
		const stored = this.read(await this.vaultModule.getState());
		if (!stored?.password) return { status: "error", message: appMessage("helloNotEnabled") };

		const verification = await this.verify("Unlock ElyVault");
		if (verification.status !== "success") return verification;

		let password: string;
		try {
			password = safeStorage.decryptString(Buffer.from(stored.password, "base64"));
		} catch {
			await this.forget();
			return { status: "error", message: appMessage("helloNoLongerValid") };
		}

		const result: UnlockResult = await this.vaultModule.unlock(password);
		if (result.status === "error" && /master password/i.test(result.message)) {
			this.logger.warn("The stored master password no longer unlocks the vault: Windows Hello unlock disabled");
			await this.forget();
			return { status: "error", message: appMessage("helloPasswordChanged") };
		}
		return result;
	}

	private async isAvailable() {
		if (process.platform !== "win32" || !safeStorage.isEncryptionAvailable()) return false;
		try {
			return await isHelloAvailable();
		} catch (error) {
			this.logger.warn("Windows Hello check failed", error instanceof Error ? error.message : String(error));
			return false;
		}
	}

	/** Windows Hello dialog in front of the main window */
	private async verify(message: string): Promise<HelloUnlockResult> {
		const window = this.windowModule.window;
		if (!window) return { status: "error", message: verificationErrors.unavailable };
		if (this.verifying) return { status: "canceled" };

		this.verifying = true;
		try {
			const handle = window.getNativeWindowHandle();
			const verification = await requestHelloVerification(handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE()), message);
			if (verification === "verified") return { status: "success" };
			if (verification === "canceled") return { status: "canceled" };
			return { status: "error", message: verificationErrors[verification] };
		} catch (error) {
			this.logger.error("Windows Hello verification failed", error instanceof Error ? error.message : String(error));
			return { status: "error", message: verificationErrors.unavailable };
		} finally {
			this.verifying = false;
		}
	}

	/** Stored password of the current account, null for none or another account */
	private read(account: AccountInfo): StoredUnlock | null {
		try {
			const stored = JSON.parse(fs.readFileSync(this.storePath, "utf-8")) as StoredUnlock;
			return stored.email === account.email && stored.serverUrl === account.serverUrl ? stored : null;
		} catch {
			return null;
		}
	}
}
