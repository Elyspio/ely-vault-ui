import type { BwItem } from "../bitwarden/bw.types";
import { AUTOTYPE_FIELD_NAME, AutoTypeSequenceError, type AutoTypeToken, parseAutoTypeSequence } from "@shared/autotype/autotype.sequence";
import type { AppConfig } from "@shared/config/app.config";
import { FieldType } from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";

/**
 * Tokens typed for an item: its "autotype" custom field as is, otherwise the default sequence followed by Enter if configured
 */
export function getItemSequence(item: BwItem, config: AppConfig["autoType"]): AutoTypeToken[] {
	const override = item.fields?.find(
		(field) => (field.type === FieldType.Text || field.type === FieldType.Hidden) && field.name?.trim().toLowerCase() === AUTOTYPE_FIELD_NAME && field.value?.trim()
	);

	if (override) {
		try {
			return parseAutoTypeSequence(override.value!);
		} catch (error) {
			// The field may be hidden: its content never goes back to the renderer
			if (error instanceof AutoTypeSequenceError) {
				throw new AutoTypeSequenceError(appMessage("sequenceInvalidItem", { field: AUTOTYPE_FIELD_NAME, position: error.position }), error.position);
			}
			throw error;
		}
	}

	try {
		const tokens = parseAutoTypeSequence(config.defaultSequence);
		return config.pressEnter ? [...tokens, { kind: "key", key: "enter" }] : tokens;
	} catch (error) {
		if (error instanceof AutoTypeSequenceError) throw new AutoTypeSequenceError(appMessage("sequenceInvalidDefault", { detail: error.message }), error.position);
		throw error;
	}
}
