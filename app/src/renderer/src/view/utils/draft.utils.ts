import {
	CipherType,
	type DraftField,
	FieldType,
	type IdentityKey,
	identityKeys,
	type ItemDraft,
	type SecretChange,
	type VaultField,
	type VaultItem,
} from "@shared/types/vault.types";
import { isValidTotp } from "@shared/vault/totp";

/**
 * Pure helpers of the item editor: conversion between a sanitized item and an {@link ItemDraft}, dirty check and
 * client-side validation. Secrets never appear in a draft unless the user typed them.
 */

/** Draft of an existing item: its non-secret state, secrets absent (unchanged) */
export function itemToDraft(item: VaultItem): ItemDraft {
	const draft: ItemDraft = {
		type: item.type,
		name: item.name,
		notes: item.notes,
		favorite: item.favorite,
		reprompt: item.reprompt,
		folderId: item.folderId,
		fields: item.fields.map((field, index) => fieldToDraft(field, index)),
	};

	if (item.login) {
		draft.login = {
			username: item.login.username,
			uris: item.login.uris.map((uri) => ({ uri: uri.uri, match: uri.match })),
		};
	}
	if (item.card) {
		draft.card = {
			cardholderName: item.card.cardholderName,
			brand: item.card.brand,
			expMonth: item.card.expMonth,
			expYear: item.card.expYear,
		};
	}
	if (item.identity) draft.identity = { ...item.identity };

	return draft;
}

function fieldToDraft(field: VaultField, index: number): DraftField {
	const draft: DraftField = { originalIndex: index, name: field.name, type: field.type };
	// Hidden values are secrets (absent = unchanged), linked fields keep their link
	if (field.type === FieldType.Hidden || field.type === FieldType.Linked) return draft;
	draft.value = field.value;
	return draft;
}

/** Draft of a new item: empty sections for the type, the password pre-filled when given */
export function emptyDraft(type: CipherType, defaults: { folderId: string | null; favorite: boolean; password?: string }): ItemDraft {
	const draft: ItemDraft = {
		type,
		name: "",
		notes: null,
		favorite: defaults.favorite,
		reprompt: false,
		folderId: defaults.folderId,
		fields: [],
	};

	switch (type) {
		case CipherType.Login:
			draft.login = { username: null, uris: [] };
			if (defaults.password !== undefined) draft.login.password = { kind: "set", value: defaults.password };
			break;
		case CipherType.Card:
			draft.card = { cardholderName: null, brand: null, expMonth: null, expYear: null };
			break;
		case CipherType.Identity:
			draft.identity = Object.fromEntries(identityKeys.map((key) => [key, null])) as Record<IdentityKey, string | null>;
			break;
	}

	return draft;
}

/**
 * Whether the draft differs from the initial one. A secret set by the user is a change (its previous value is unknown),
 * unless it equals the initial one (a pre-generated password left as is).
 */
export function isDraftDirty(initial: ItemDraft, current: ItemDraft): boolean {
	return !isSameValue(initial, current);
}

/**
 * Client-side mirror of the rules checked by the main process, to show the error before the write
 */
export function draftErrors(draft: ItemDraft): string | null {
	if (draft.name.trim() === "") return "The name is required";

	const totp = draft.login?.totp;
	if (totp?.kind === "set" && !isValidTotp(totp.value)) return "The TOTP secret is not valid: use a base32 secret, an otpauth://totp uri or a steam:// secret";

	return null;
}

/** Secret change of a typed value: an empty text removes the secret */
export function toSecretChange(text: string): SecretChange {
	return text === "" ? { kind: "clear" } : { kind: "set", value: text };
}

function isSameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => isSameValue(value, b[index]));
	}

	if (isRecord(a) && isRecord(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		return [...keys].every((key) => isSameValue(a[key], b[key]));
	}

	return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
