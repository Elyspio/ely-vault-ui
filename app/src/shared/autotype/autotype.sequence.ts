/**
 * Auto-type sequences, a reduced KeePass syntax: {USERNAME} {PASSWORD} {TOTP} {TAB} {ENTER} {DELAY n} and literal text.
 * Placeholders are case-insensitive, {{} and {}} type a literal brace.
 */

export type AutoTypeField = "username" | "password" | "totp";
export type AutoTypeKey = "tab" | "enter";

export type AutoTypeToken = { kind: "text"; value: string } | { kind: "field"; field: AutoTypeField } | { kind: "key"; key: AutoTypeKey } | { kind: "delay"; ms: number };

/** Name of the custom field that overrides the default sequence of an item (case-insensitive) */
export const AUTOTYPE_FIELD_NAME = "autotype";

/** Upper bound of a {DELAY n}, in milliseconds */
export const MAX_AUTOTYPE_DELAY_MS = 10_000;

const placeholders: Record<string, AutoTypeToken> = {
	USERNAME: { kind: "field", field: "username" },
	PASSWORD: { kind: "field", field: "password" },
	TOTP: { kind: "field", field: "totp" },
	TAB: { kind: "key", key: "tab" },
	ENTER: { kind: "key", key: "enter" },
};

export class AutoTypeSequenceError extends Error {
	public constructor(
		message: string,
		/** 1-based position of the error, to explain it without repeating the sequence */
		public readonly position: number
	) {
		super(message);
		this.name = "AutoTypeSequenceError";
	}
}

/** Tab, line breaks and other control characters cannot be typed faithfully: {TAB} and {ENTER} are explicit */
// oxlint-disable-next-line no-control-regex
export const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Parses a sequence, throws an {@link AutoTypeSequenceError} on an unknown or unclosed placeholder
 */
export function parseAutoTypeSequence(sequence: string): AutoTypeToken[] {
	const tokens: AutoTypeToken[] = [];
	let text = "";

	const flushText = () => {
		if (text) tokens.push({ kind: "text", value: text });
		text = "";
	};

	let index = 0;
	while (index < sequence.length) {
		if (sequence.startsWith("{{}", index) || sequence.startsWith("{}}", index)) {
			text += sequence[index + 1];
			index += 3;
			continue;
		}

		if (CONTROL_CHARACTERS.test(sequence[index])) {
			throw new AutoTypeSequenceError(`Caractère de contrôle à la position ${index + 1} : utilisez {TAB} ou {ENTER}`, index + 1);
		}

		if (sequence[index] !== "{") {
			text += sequence[index];
			index++;
			continue;
		}

		const end = sequence.indexOf("}", index + 1);
		if (end === -1) throw new AutoTypeSequenceError(`Accolade non fermée à la position ${index + 1}`, index + 1);

		const content = sequence.slice(index + 1, end).trim();
		flushText();
		tokens.push(parsePlaceholder(content, index + 1));
		index = end + 1;
	}

	flushText();
	return tokens;
}

function parsePlaceholder(content: string, position: number): AutoTypeToken {
	const upper = content.toUpperCase();
	const placeholder = placeholders[upper];
	if (placeholder) return placeholder;

	const delay = /^DELAY\s+(\d+)$/.exec(upper);
	if (delay) {
		const ms = Number(delay[1]);
		if (ms > MAX_AUTOTYPE_DELAY_MS) throw new AutoTypeSequenceError(`Délai trop long : {${content}} (${MAX_AUTOTYPE_DELAY_MS} ms au plus)`, position);
		return { kind: "delay", ms };
	}

	throw new AutoTypeSequenceError(`Code inconnu : {${content}}`, position);
}

/**
 * Message of an invalid sequence, null when it is valid
 */
export function validateAutoTypeSequence(sequence: string): string | null {
	try {
		parseAutoTypeSequence(sequence);
		return null;
	} catch (error) {
		return error instanceof AutoTypeSequenceError ? error.message : String(error);
	}
}
