import { currentLanguage } from "@/config/i18n";
import type { Language } from "@shared/i18n/i18n.languages";

const formatters = new Map<Language, { relative: Intl.RelativeTimeFormat; dateTime: Intl.DateTimeFormat }>();

/** Date formats of the current language */
function format() {
	const language = currentLanguage();
	let formatter = formatters.get(language);
	if (!formatter) {
		formatter = {
			relative: new Intl.RelativeTimeFormat(language, { numeric: "auto" }),
			dateTime: new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short" }),
		};
		formatters.set(language, formatter);
	}
	return formatter;
}

export function formatRelative(iso: string) {
	const { relative } = format();
	const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
	const abs = Math.abs(seconds);
	if (abs < 60) return relative.format(seconds, "second");
	if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
	if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
	return relative.format(Math.round(seconds / 86400), "day");
}

export function formatDateTime(iso: string) {
	return format().dateTime.format(new Date(iso));
}
