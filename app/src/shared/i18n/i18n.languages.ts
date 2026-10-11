/** Languages of the user interface; English is the source of the translations and the fallback */
export const languages = ["en", "fr"] as const;

export type Language = (typeof languages)[number];

/** Language setting: "system" follows the language of the operating system */
export type LanguageSetting = Language | "system";

export const fallbackLanguage: Language = "en";

/**
 * Language of the interface for a setting; with "system", the first supported language among the locales
 * of the operating system (BCP 47, "fr-FR"), English when none is supported
 */
export function resolveLanguage(setting: LanguageSetting, systemLocales: readonly string[]): Language {
	if (setting !== "system") return setting;
	for (const locale of systemLocales) {
		const base = locale.toLowerCase().split(/[-_]/)[0];
		const match = languages.find((language) => language === base);
		if (match) return match;
	}
	return fallbackLanguage;
}
