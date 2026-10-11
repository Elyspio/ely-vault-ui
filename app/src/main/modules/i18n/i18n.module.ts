import { app } from "electron";
import i18next from "i18next";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { ConfigModule } from "../config/config.module";
import type { main } from "@shared/i18n/en/main";
import { fallbackLanguage, resolveLanguage } from "@shared/i18n/i18n.languages";
import { i18nOptions } from "@shared/i18n/resources";

export type MainTextKey = keyof typeof main;

/**
 * Texts shown by the main process itself (native dialogs), in the language of the interface.
 * Messages sent to the renderer are codes instead (see appMessage), translated there.
 */
@injectable()
export class I18nModule extends LogModule {
	private readonly i18n = i18next.createInstance();

	public constructor(@inject(ConfigModule) private readonly configModule: ConfigModule) {
		super("I18nModule");
		void this.i18n.init({ ...i18nOptions, lng: fallbackLanguage });
	}

	public async t(key: MainTextKey): Promise<string> {
		const { display } = await this.configModule.getConfig();
		return this.i18n.t(`main:${key}`, { lng: resolveLanguage(display.language, [app.getLocale()]) });
	}
}
