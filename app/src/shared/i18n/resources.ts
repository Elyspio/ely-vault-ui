import type { InitOptions } from "i18next";
import { en } from "./en";
import { fr } from "./fr";
import { fallbackLanguage, languages } from "./i18n.languages";

export const resources = { en, fr };

/** Options shared by the main process and the renderer */
export const i18nOptions = {
	resources,
	fallbackLng: fallbackLanguage,
	supportedLngs: [...languages],
	defaultNS: "common",
	ns: Object.keys(en),
	// React and native dialogs escape the texts themselves
	interpolation: { escapeValue: false },
	initAsync: false,
} satisfies InitOptions;
