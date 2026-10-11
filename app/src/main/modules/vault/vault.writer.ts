import type { BwField, BwFolder, BwItem } from "../bitwarden/bw.types";
import { CipherType, type DraftField, FieldType, type IdentityKey, identityKeys, type ItemDraft, type SecretChange } from "@shared/types/vault.types";
import { folderSegments, joinFolderSegments } from "@shared/vault/folder.path";

/**
 * Pure rules of the write operations: they build the request bodies sent to `bw serve` and validate the drafts.
 * The CLI replaces nested objects on edit, so the body always starts from the full raw item.
 */

type LoginDraft = NonNullable<ItemDraft["login"]>;
type CardDraft = NonNullable<ItemDraft["card"]>;
type RawRecord = Record<string, unknown>;

const PROTECTED_FIELDS_MESSAGE = "Hidden fields protected by the organization cannot be renamed, moved or removed";

/** Request body for POST /object/item (original null) or PUT /object/item/:id: the original raw item with the draft applied */
export function applyDraft(original: BwItem | null, draft: ItemDraft): RawRecord {
	const item: RawRecord = original ? structuredClone(original) : { type: draft.type, organizationId: null, collectionIds: [] };

	item.name = draft.name.trim();
	item.notes = emptyToNull(draft.notes);
	item.favorite = draft.favorite;
	item.reprompt = draft.reprompt ? 1 : 0;
	item.folderId = draft.folderId;
	item.fields = applyFields((original?.fields ?? []) as BwField[], draft.fields);

	const type = item.type as CipherType;

	if (type === CipherType.Login && (draft.login || !original)) {
		item.login = applyLogin((item.login as RawRecord | undefined) ?? defaultLogin(), draft.login);
	}
	if (type === CipherType.SecureNote && !original) {
		item.secureNote = { type: 0 };
	}
	if (type === CipherType.Card && (draft.card || !original)) {
		item.card = applyCard((item.card as RawRecord | undefined) ?? defaultCard(), draft.card);
	}
	if (type === CipherType.Identity && (draft.identity || !original)) {
		item.identity = applyIdentity((item.identity as RawRecord | undefined) ?? defaultIdentity(), draft.identity);
	}
	if (type === CipherType.SshKey && draft.sshKey) {
		item.sshKey = {
			privateKey: draft.sshKey.privateKey,
			publicKey: draft.sshKey.publicKey,
			keyFingerprint: draft.sshKey.keyFingerprint,
		};
	}

	return item;
}

/** Error message when the draft cannot be written, null when valid */
export function validateDraft(original: BwItem | null, draft: ItemDraft): string | null {
	if (draft.name.trim() === "") return "The name is required";

	if (original) {
		if (!isCipherType(original.type)) return "This item type cannot be edited";
		if (draft.type !== original.type) return "The item type cannot change";
		if (original.deletedDate) return "Restore the item before editing it";
	} else {
		if (!isCipherType(draft.type)) return "Unsupported item type";
		if (draft.type === CipherType.SshKey && !hasSshKey(draft.sshKey)) return "An SSH key needs a private key, a public key and a fingerprint";
	}

	const originalFields = (original?.fields ?? []) as BwField[];
	const usedIndexes = new Set<number>();
	for (const field of draft.fields) {
		if (field.originalIndex === null) {
			if (field.type === FieldType.Linked) return "Linked fields cannot be created";
			continue;
		}

		const source = originalFields[field.originalIndex];
		if (!source) return "A custom field refers to a field that does not exist";
		if (usedIndexes.has(field.originalIndex)) return "A custom field is listed more than once";
		usedIndexes.add(field.originalIndex);
		if ((source.type === FieldType.Linked) !== (field.type === FieldType.Linked)) return "Linked fields keep their type";
	}

	if (original?.organizationId) {
		const error = checkRedactedFields(original, draft);
		if (error) return error;
	}

	const totp = draft.login?.totp;
	if (totp?.kind === "set" && !isValidTotp(totp.value)) return "Invalid TOTP secret";

	return null;
}

/** Accepts a base32 secret, an otpauth://totp uri or a steam:// secret. No TOTP is computed here. */
export function isValidTotp(value: string): boolean {
	const trimmed = value.trim();
	const lower = trimmed.toLowerCase();

	if (lower.startsWith("otpauth://")) {
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			return false;
		}
		if (url.protocol !== "otpauth:" || url.host !== "totp") return false;
		return isBase32Secret(url.searchParams.get("secret") ?? "");
	}

	if (lower.startsWith("steam://")) return isBase32Secret(trimmed.slice("steam://".length));

	return isBase32Secret(trimmed);
}

/** The server refused an edit made on a stale copy of the item */
export function isConflictError(message: string): boolean {
	return /out of date/i.test(message);
}

/** Folders to rename (raw folder list from the CLI, may contain the virtual "No folder" entry with id null) */
export function planFolderRename(folders: BwFolder[], path: string, newPath: string): { renames: { id: string; name: string }[] } | { error: string } {
	const from = folderSegments(path);
	const to = folderSegments(newPath);

	if (from.length === 0) return { error: "The folder name is empty" };
	if (to.length === 0) return { error: "The new folder name is empty" };
	if (joinFolderSegments(to) === joinFolderSegments(from)) return { error: "The new name is the same as the current one" };
	if (startsWithSegments(to, from)) return { error: "A folder cannot be moved inside itself" };

	const realFolders = folders.filter((folder): folder is BwFolder & { id: string } => folder.id !== null);
	const affected = realFolders.filter((folder) => startsWithSegments(folderSegments(folder.name), from));
	if (affected.length === 0) return { error: `No folder under "${joinFolderSegments(from)}"` };

	const renames = affected.map((folder) => {
		const segments = folderSegments(folder.name);
		return { id: folder.id, name: joinFolderSegments([...to, ...segments.slice(from.length)]), depth: segments.length };
	});

	const affectedIds = new Set(affected.map((folder) => folder.id));
	const existingNames = new Set(realFolders.filter((folder) => !affectedIds.has(folder.id)).map((folder) => joinFolderSegments(folderSegments(folder.name))));
	for (const rename of renames) {
		if (existingNames.has(rename.name)) return { error: `A folder named "${rename.name}" already exists` };
	}

	renames.sort((a, b) => a.depth - b.depth);
	return { renames: renames.map(({ id, name }) => ({ id, name })) };
}

/** Error message when the folder cannot be deleted, null when it can. `activeItems` excludes the trash */
export function checkFolderDelete(folders: BwFolder[], activeItems: BwItem[], folderId: string): string | null {
	const folder = folders.find((candidate) => candidate.id === folderId);
	if (!folder) return "Folder not found";

	if (activeItems.some((item) => item.folderId === folderId)) return "Move or delete its items first";

	const segments = folderSegments(folder.name);
	const hasSubFolder = folders.some((candidate) => {
		if (candidate.id === null) return false;
		const candidateSegments = folderSegments(candidate.name);
		return candidateSegments.length > segments.length && startsWithSegments(candidateSegments, segments);
	});
	if (hasSubFolder) return "Delete its sub folders first";

	return null;
}

// region Body builders

function applyFields(original: BwField[], fields: DraftField[]): BwField[] {
	return fields.map((field) => {
		if (field.originalIndex === null) {
			return {
				name: field.name,
				type: field.type,
				value: field.type === FieldType.Hidden ? applySecret(field.secret, null) : (field.value ?? null),
				linkedId: null,
			};
		}

		const source = original[field.originalIndex];
		const clone = structuredClone(source);
		clone.name = field.name;

		// Linked fields keep their link and value, only the name can change
		if (source.type === FieldType.Linked) return clone;

		clone.type = field.type;
		if (field.type === FieldType.Hidden) {
			clone.value = applySecret(field.secret, source.value);
		} else {
			clone.value = field.value ?? null;
		}
		return clone;
	});
}

function applyLogin(current: RawRecord, change: LoginDraft | undefined): RawRecord {
	if (!change) return current;
	return {
		...current,
		username: emptyToNull(change.username),
		uris: change.uris.map((uri) => ({ uri: uri.uri.trim(), match: uri.match ?? null })).filter((uri) => uri.uri !== ""),
		password: applySecret(change.password, current.password),
		totp: applySecret(change.totp, current.totp),
	};
}

function applyCard(current: RawRecord, change: CardDraft | undefined): RawRecord {
	if (!change) return current;
	return {
		...current,
		cardholderName: emptyToNull(change.cardholderName),
		brand: emptyToNull(change.brand),
		expMonth: emptyToNull(change.expMonth),
		expYear: emptyToNull(change.expYear),
		number: applySecret(change.number, current.number),
		code: applySecret(change.code, current.code),
	};
}

function applyIdentity(current: RawRecord, change: ItemDraft["identity"]): RawRecord {
	if (!change) return current;
	const values = Object.fromEntries(Object.entries(change).map(([key, value]) => [key, emptyToNull(value)]));
	return { ...current, ...values };
}

/**
 * Value of a secret: an absent change keeps the current value, `set` replaces it, `clear` removes it
 */
function applySecret(change: SecretChange | undefined, current: unknown): string | null {
	if (!change) return (current as string | null | undefined) ?? null;
	return change.kind === "clear" ? null : change.value;
}

function defaultLogin(): RawRecord {
	return { username: null, password: null, totp: null, uris: [], fido2Credentials: [] };
}

function defaultCard(): RawRecord {
	return { cardholderName: null, brand: null, number: null, expMonth: null, expYear: null, code: null };
}

function defaultIdentity(): RawRecord {
	return Object.fromEntries(identityKeys.map((key: IdentityKey) => [key, null]));
}

// endregion

// region Helpers

/**
 * Redacted organization items: the CLI restores hidden values that come back null, matching them by name and order
 */
function checkRedactedFields(original: BwItem, draft: ItemDraft): string | null {
	const originalFields = (original.fields ?? []) as BwField[];
	const redacted = originalFields.filter((field) => field.type === FieldType.Hidden && field.value === null);

	for (const [index, field] of originalFields.entries()) {
		if (!redacted.includes(field)) continue;
		const kept = draft.fields.some((candidate) => candidate.originalIndex === index && candidate.name === field.name && candidate.type === FieldType.Hidden);
		if (!kept) return PROTECTED_FIELDS_MESSAGE;
	}

	for (const name of new Set(redacted.map((field) => field.name ?? ""))) {
		const originalOrder = originalFields.flatMap((field, index) => ((field.name ?? "") === name ? [index] : []));
		const draftOrder = draft.fields.flatMap((field) => (field.name === name && field.originalIndex !== null ? [field.originalIndex] : []));
		if (!sameSequence(originalOrder, draftOrder)) return PROTECTED_FIELDS_MESSAGE;
		// A new field with the same name could take the value the CLI restores
		if (draft.fields.some((field) => field.originalIndex === null && field.name === name)) return PROTECTED_FIELDS_MESSAGE;
		// Same for a value set on one of several same-named fields: the next ones would get the wrong values
		const group = redacted.filter((field) => (field.name ?? "") === name);
		const changed = draft.fields.some((field) => field.originalIndex !== null && group.includes(originalFields[field.originalIndex]) && field.secret);
		if (group.length > 1 && changed) return PROTECTED_FIELDS_MESSAGE;
	}

	return null;
}

function sameSequence(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function startsWithSegments(segments: string[], prefix: string[]): boolean {
	return prefix.length <= segments.length && prefix.every((segment, index) => segments[index] === segment);
}

function isCipherType(type: number): boolean {
	return type >= CipherType.Login && type <= CipherType.SshKey;
}

function hasSshKey(sshKey: ItemDraft["sshKey"]): boolean {
	return Boolean(sshKey && sshKey.privateKey.trim() && sshKey.publicKey.trim() && sshKey.keyFingerprint.trim());
}

function isBase32Secret(value: string): boolean {
	const cleaned = value.replaceAll(/[\s=]/g, "");
	return cleaned.length >= 16 && /^[A-Z2-7]+$/i.test(cleaned);
}

function emptyToNull(value: string | null | undefined): string | null {
	return value ? value : null;
}

// endregion
