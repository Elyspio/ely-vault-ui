import type { BwItem } from "../bitwarden/bw.types";
import { CipherType, type CopyRef, FieldType, identityKeys, type LoginUri, type SecretRef, type UriMatchType, type VaultItem } from "@shared/types/vault.types";

/**
 * Removes every secret of a decrypted item: the renderer only gets what it displays without a click.
 */
export function sanitizeItem(item: BwItem): VaultItem {
	const result: VaultItem = {
		id: item.id,
		type: item.type as CipherType,
		name: item.name,
		notes: item.notes ?? null,
		favorite: item.favorite,
		reprompt: item.reprompt === 1,
		folderId: item.folderId ?? null,
		organizationId: item.organizationId ?? null,
		collectionIds: item.collectionIds ?? [],
		revisionDate: item.revisionDate,
		creationDate: item.creationDate ?? null,
		deletedDate: item.deletedDate ?? null,
		passwordHistoryCount: item.passwordHistory?.length ?? 0,
		fields: (item.fields ?? []).map((field) => {
			const hidden = field.type === FieldType.Hidden;
			return {
				name: field.name ?? "",
				type: field.type as FieldType,
				value: hidden ? null : (field.value ?? null),
				hasValue: Boolean(field.value),
				linkedId: field.linkedId ?? null,
			};
		}),
	};

	if (item.login) {
		result.login = {
			username: item.login.username ?? null,
			uris: (item.login.uris ?? []).filter((u) => u.uri).map((u) => toLoginUri(u.uri!, u.match)),
			hasPassword: Boolean(item.login.password),
			hasTotp: Boolean(item.login.totp),
			passwordRevisionDate: item.login.passwordRevisionDate ?? null,
			passkeyCount: item.login.fido2Credentials?.length ?? 0,
		};
	}

	if (item.card) {
		const digits = item.card.number?.replaceAll(/\D/g, "") ?? "";
		result.card = {
			cardholderName: item.card.cardholderName ?? null,
			brand: item.card.brand ?? null,
			expMonth: item.card.expMonth ?? null,
			expYear: item.card.expYear ?? null,
			numberLast4: digits.length >= 4 ? digits.slice(-4) : null,
			hasNumber: Boolean(item.card.number),
			hasCode: Boolean(item.card.code),
		};
	}

	if (item.identity) {
		const identity = item.identity;
		result.identity = Object.fromEntries(identityKeys.map((key) => [key, identity[key] ?? null])) as VaultItem["identity"];
	}

	if (item.sshKey) {
		result.sshKey = {
			publicKey: item.sshKey.publicKey ?? null,
			keyFingerprint: item.sshKey.keyFingerprint ?? null,
			hasPrivateKey: Boolean(item.sshKey.privateKey),
		};
	}

	return result;
}

export function toLoginUri(uri: string, match?: UriMatchType | number | null): LoginUri {
	return { uri, host: getHost(uri), match: (match ?? null) as UriMatchType | null };
}

/**
 * Hostname of a web address, also for uris saved without scheme ("github.com")
 */
export function getHost(uri: string): string | null {
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(uri) ? uri : `https://${uri}`;
	try {
		const url = new URL(candidate);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.hostname.includes(".") || url.hostname === "localhost" ? url.hostname : null;
	} catch {
		return null;
	}
}

/**
 * Secret value of an item, or null when the item has none
 */
export function getSecretValue(item: BwItem, ref: SecretRef): string | null {
	switch (ref.kind) {
		case "password":
			return item.login?.password ?? null;
		case "cardNumber":
			return item.card?.number ?? null;
		case "cardCode":
			return item.card?.code ?? null;
		case "sshPrivateKey":
			return item.sshKey?.privateKey ?? null;
		case "field":
			return item.fields?.[ref.index]?.value ?? null;
	}
}

export function isSecretRef(ref: CopyRef): ref is SecretRef {
	return ["password", "cardNumber", "cardCode", "sshPrivateKey", "field"].includes(ref.kind);
}

/**
 * Non-secret copyable value of an item (username, uri, notes)
 */
export function getPlainValue(item: BwItem, ref: Exclude<CopyRef, SecretRef | { kind: "totp" } | { kind: "text" }>): string | null {
	switch (ref.kind) {
		case "username":
			return item.login?.username ?? null;
		case "uri":
			return item.login?.uris?.[ref.index]?.uri ?? null;
		case "notes":
			return item.notes ?? null;
	}
}

/**
 * TOTP period from the stored value: an otpauth:// uri may set it, Steam and raw secrets use 30 s
 */
export function getTotpPeriod(totp: string | null | undefined): number {
	if (!totp?.toLowerCase().startsWith("otpauth://")) return 30;
	try {
		const period = Number(new URL(totp).searchParams.get("period"));
		return Number.isInteger(period) && period > 0 ? period : 30;
	} catch {
		return 30;
	}
}
