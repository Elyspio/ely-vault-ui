import path from "node:path";
import * as fs from "node:fs";
import { app } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { type AppConfig, clampPanelLayout, defaultAppConfig, readUpdateSettings } from "@shared/config/app.config";

@injectable()
export class ConfigModule extends LogModule {
	private configCache: AppConfig | undefined;

	public constructor(@inject(MainContextModule) private readonly mainContextModule: MainContextModule) {
		super("ConfigModule");
	}

	private get configFilePath() {
		return path.join(this.mainContextModule.appFolder, "config.json");
	}

	public async getConfig(): Promise<AppConfig> {
		if (this.configCache) return this.configCache;

		try {
			const parsed = JSON.parse(await fs.promises.readFile(this.configFilePath, "utf-8")) as Partial<AppConfig>;
			// Sections added later get their defaults
			this.configCache = {
				...defaultAppConfig,
				...parsed,
				security: { ...defaultAppConfig.security, ...parsed.security },
				display: { ...defaultAppConfig.display, ...parsed.display },
				autoType: { ...defaultAppConfig.autoType, ...parsed.autoType },
				updates: readUpdateSettings(parsed.updates, app.getVersion()),
				layout: clampPanelLayout({ ...defaultAppConfig.layout, ...parsed.layout }),
				window: { ...defaultAppConfig.window, ...parsed.window },
			};
		} catch {
			this.configCache = { ...structuredClone(defaultAppConfig), updates: readUpdateSettings(undefined, app.getVersion()) };
		}

		return this.configCache;
	}

	public async writeConfig(config: AppConfig) {
		this.configCache = config;
		await fs.promises.writeFile(this.configFilePath, JSON.stringify(config, null, 4));
	}

	public async update(updater: (config: AppConfig) => AppConfig) {
		await this.writeConfig(updater(await this.getConfig()));
	}
}
