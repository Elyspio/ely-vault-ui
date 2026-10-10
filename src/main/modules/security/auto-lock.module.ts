import { powerMonitor } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { ConfigModule } from "../config/config.module";
import { VaultModule } from "../vault/vault.module";

/**
 * Locks the vault after the configured system inactivity, and when the session is locked or the computer sleeps
 */
@injectable()
export class AutoLockModule extends LogModule {
	private timer: NodeJS.Timeout | null = null;

	public constructor(
		@inject(ConfigModule) private readonly configModule: ConfigModule,
		@inject(VaultModule) private readonly vaultModule: VaultModule
	) {
		super("AutoLockModule");
	}

	public start() {
		const lockOnSystemEvent = (reason: string) => async () => {
			const { lockOnSystemLock } = (await this.configModule.getConfig()).security;
			if (lockOnSystemLock && this.vaultModule.isUnlocked) {
				this.logger.info(`Locking: ${reason}`);
				await this.vaultModule.lock();
			}
		};

		powerMonitor.on("lock-screen", lockOnSystemEvent("system locked"));
		powerMonitor.on("suspend", lockOnSystemEvent("system suspended"));

		this.timer = setInterval(() => void this.checkIdle(), 15_000);
	}

	public stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	private async checkIdle() {
		if (!this.vaultModule.isUnlocked) return;

		const { autoLockMinutes } = (await this.configModule.getConfig()).security;
		if (autoLockMinutes && powerMonitor.getSystemIdleTime() >= autoLockMinutes * 60) {
			this.logger.info(`Locking: ${autoLockMinutes} min of inactivity`);
			await this.vaultModule.lock();
		}
	}
}
