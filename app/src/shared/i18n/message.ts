import type { messages } from "./en/messages";

export type MessageKey = keyof typeof messages;

export type MessageParams = Record<string, string | number>;

/** A message of the main process, translated by the renderer */
export type AppMessage = { key: MessageKey; params?: MessageParams };

const PREFIX = "i18n:";
const ENCODED = /^i18n:(\w+)(?: (\{.*\}))?$/s;

/**
 * Message of the main process for the renderer, as text: results and thrown errors keep their `message: string`.
 * A parameter may be another encoded message, or the raw text of an error (Bitwarden CLI, network).
 */
export function appMessage(key: MessageKey, params?: MessageParams): string {
	return params ? `${PREFIX}${key} ${JSON.stringify(params)}` : `${PREFIX}${key}`;
}

/** Key and parameters of an encoded message, null for a raw text */
export function parseAppMessage(text: string): AppMessage | null {
	const match = ENCODED.exec(text);
	if (!match) return null;
	try {
		return { key: match[1] as MessageKey, params: match[2] ? (JSON.parse(match[2]) as MessageParams) : undefined };
	} catch {
		return null;
	}
}

/** Whether a text is the given message (the raw text of an error never is) */
export function isAppMessage(text: string, key: MessageKey) {
	return parseAppMessage(text)?.key === key;
}
