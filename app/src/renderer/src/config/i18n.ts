import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { type Language, type LanguageSetting, resolveLanguage } from "@shared/i18n/i18n.languages";
import { i18nOptions } from "@shared/i18n/resources";

/** Locales of the operating system, as Chromium reports them */
const systemLocales = () => globalThis.navigator?.languages ?? [];

/**
 * Translations of the renderer. Components use `useTranslation`; code outside React (store, hooks callbacks) uses `i18n.t`.
 * Starts on the system language, then follows the setting once the configuration is loaded.
 */
export const i18n: I18n = i18next.createInstance();

void i18n.use(initReactI18next).init({ ...i18nOptions, lng: resolveLanguage("system", systemLocales()) });

export function currentLanguage(): Language {
	return i18n.language as Language;
}

/** Language of the interface for a setting */
export function languageOfSetting(setting: LanguageSetting): Language {
	return resolveLanguage(setting, systemLocales());
}
