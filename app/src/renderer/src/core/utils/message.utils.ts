import { i18n } from "@/config/i18n";
import { type MessageParams, parseAppMessage } from "@shared/i18n/message";

/**
 * Text of a message of the main process in the current language: encoded messages (see appMessage) are translated,
 * raw texts (Bitwarden CLI, network errors) are kept as is
 */
export function translateMessage(text: string): string {
	const message = parseAppMessage(text);
	if (!message) return text;

	const params: MessageParams = {};
	for (const [name, value] of Object.entries(message.params ?? {})) params[name] = typeof value === "string" ? translateMessage(value) : value;
	return i18n.t(`messages:${message.key}`, params);
}

/** Translate message fields in IPC results while preserving vault contents and other data. */
export function translateMessages<T>(value: T): T {
	if (Array.isArray(value)) return value.map((entry) => translateMessages(entry)) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				typeof entry === "string" && ["message", "reason", "refreshError"].includes(key) ? translateMessage(entry) : translateMessages(entry),
			])
		) as T;
	}
	return value;
}
