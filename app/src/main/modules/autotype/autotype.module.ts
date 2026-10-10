import type { BrowserWindow } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { ConfigModule } from "../config/config.module";
import { VaultModule } from "../vault/vault.module";
import { WindowModule } from "../window/window.module";
import { getItemSequence } from "./autotype.resolve";
import { type AutoTypeDriver, sleep } from "./autotype.driver";
import { log } from "@main/utils/logs.utils";
import { type AutoTypeField, CONTROL_CHARACTERS } from "@shared/autotype/autotype.sequence";
import { type AutoTypeAvailability, CipherType } from "@shared/types/vault.types";

/** How long the focus may take to leave the minimized window */
const TARGET_TIMEOUT_MS = 1000;
/** How long the user may keep Ctrl+V pressed before auto-type gives up */
const KEYS_TIMEOUT_MS = 2000;

type DriverResult = { driver: AutoTypeDriver } | { reason: string };

/**
 * KeePass-like auto-type: minimizes the window, then types the sequence of a login into the window that gets the focus.
 *
 * Secrets are resolved here and never reach the renderer. Typing stops as soon as the foreground window changes.
 */
@injectable()
export class AutoTypeModule extends LogModule {
	private driver: Promise<DriverResult> | null = null;
	private running = false;

	public constructor(
		@inject(VaultModule) private readonly vaultModule: VaultModule,
		@inject(WindowModule) private readonly windowModule: WindowModule,
		@inject(ConfigModule) private readonly configModule: ConfigModule
	) {
		super("AutoTypeModule");
	}

	public async getAvailability(): Promise<AutoTypeAvailability> {
		const result = await this.getDriver();
		return "driver" in result ? { available: true } : { available: false, reason: result.reason };
	}

	@log("info")
	public async perform(itemId: string) {
		// Taken before any await: two quick Ctrl+V would interleave their keystrokes
		if (this.running) throw new Error("Auto-type already in progress");
		this.running = true;
		try {
			await this.run(itemId);
		} finally {
			this.running = false;
		}
	}

	private async run(itemId: string) {
		const result = await this.getDriver();
		if ("reason" in result) throw new Error(result.reason);
		const { driver } = result;

		// Everything that can fail or ask for the master password happens before the window is minimized
		const item = this.vaultModule.getProtectedItem(itemId);
		const login = item.type === CipherType.Login ? item.login : undefined;
		if (!login?.username && !login?.password) throw new Error("Auto-type needs a login with a username or a password");

		const config = (await this.configModule.getConfig()).autoType;
		const tokens = getItemSequence(item, config);
		const values: Record<Exclude<AutoTypeField, "totp">, string> = { username: login.username ?? "", password: login.password ?? "" };
		if (tokens.some((token) => token.kind === "field" && token.field !== "totp" && CONTROL_CHARACTERS.test(values[token.field]))) {
			throw new Error("Cannot type: the username or the password contains a tab or a line break");
		}

		const window = this.windowModule.window;
		if (!window) throw new Error("Window not found");

		try {
			const ownId = nativeWindowId(window);
			window.minimize();

			const target = await this.waitForTarget(driver, ownId);
			if (!target) throw new Error("No target window: auto-type types into the window opened before Vault");
			if (!(await driver.waitForKeysReleased(KEYS_TIMEOUT_MS))) throw new Error("Auto-type cancelled: release Ctrl, Shift, Alt and V");

			const check = async () => {
				if (!this.vaultModule.isUnlocked) throw new Error("Auto-type stopped: the vault was locked");
				if ((await driver.getForegroundWindow()) !== target) throw new Error("Auto-type stopped: the active window changed");
			};

			for (const token of tokens) {
				await check();
				if (token.kind === "text") await driver.typeText(token.value, check);
				else if (token.kind === "field") await driver.typeText(await this.getFieldValue(token.field, values, itemId, Boolean(login.totp)), check);
				else if (token.kind === "key") await driver.pressKey(token.key);
				else await sleep(token.ms);
			}
		} catch (error) {
			// Show the window again so the error toast is seen
			this.windowModule.focusMainWindow();
			throw error;
		}

		if (config.afterTyping === "restore") this.windowModule.focusMainWindow();
		else if (config.afterTyping === "lock") await this.vaultModule.lock();
	}

	/**
	 * The TOTP code is computed when its turn comes: a {DELAY n} before it must not make it expire
	 */
	private async getFieldValue(field: AutoTypeField, values: Record<Exclude<AutoTypeField, "totp">, string>, itemId: string, hasTotp: boolean) {
		if (field !== "totp") return values[field];
		return hasTotp ? (await this.vaultModule.getTotp(itemId)).code : "";
	}

	/**
	 * Waits for the focus to move to another window than ours, which becomes the target
	 */
	private async waitForTarget(driver: AutoTypeDriver, ownId: string) {
		const deadline = Date.now() + TARGET_TIMEOUT_MS;
		do {
			await sleep(50);
			const foreground = await driver.getForegroundWindow();
			if (foreground && foreground !== ownId) return foreground;
		} while (Date.now() < deadline);
		return null;
	}

	private getDriver() {
		this.driver ??= this.loadDriver();
		return this.driver;
	}

	private async loadDriver(): Promise<DriverResult> {
		try {
			if (process.platform === "win32") {
				const { WindowsAutoTypeDriver } = await import("./autotype.windows");
				return { driver: new WindowsAutoTypeDriver() };
			}

			if (process.platform === "linux") {
				const { LinuxAutoTypeDriver, getXdotoolUnavailableReason } = await import("./autotype.linux");
				const reason = await getXdotoolUnavailableReason();
				return reason ? { reason } : { driver: new LinuxAutoTypeDriver() };
			}

			return { reason: "Auto-type is not available on this system" };
		} catch (error) {
			this.logger.error("Auto-type driver unavailable", error instanceof Error ? error.message : error);
			return { reason: "Auto-type unavailable: system module not found" };
		}
	}
}

/**
 * HWND on Windows, X11 window id on Linux, in the same decimal form as the drivers
 */
function nativeWindowId(window: BrowserWindow) {
	const handle = window.getNativeWindowHandle();
	return (handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0))).toString();
}
