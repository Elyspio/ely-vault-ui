import { describe, expect, it } from "vite-plus/test";
import { CipherType, FieldType, UriMatchType, type VaultItem } from "@shared/types/vault.types";
import { draftErrors, emptyDraft, isDraftDirty, itemToDraft, toSecretChange } from "./draft.utils";

const loginItem: VaultItem = {
	id: "1",
	type: CipherType.Login,
	name: "Example",
	notes: "note",
	favorite: true,
	reprompt: false,
	folderId: "f1",
	organizationId: null,
	collectionIds: [],
	revisionDate: "2026-01-01T00:00:00Z",
	creationDate: null,
	deletedDate: null,
	fields: [
		{ name: "pin", type: FieldType.Hidden, value: null, hasValue: true, linkedId: null },
		{ name: "color", type: FieldType.Text, value: "blue", hasValue: true, linkedId: null },
		{ name: "linked", type: FieldType.Linked, value: null, hasValue: false, linkedId: 1 },
	],
	passwordHistoryCount: 0,
	login: {
		username: "me",
		uris: [{ uri: "https://example.com", host: "example.com", match: UriMatchType.Host }],
		hasPassword: true,
		hasTotp: false,
		passwordRevisionDate: null,
		passkeyCount: 0,
	},
};

describe("itemToDraft", () => {
	it("keeps the non-secret state and drops the secrets", () => {
		const draft = itemToDraft(loginItem);

		expect(draft.name).toBe("Example");
		expect(draft.login).toEqual({ username: "me", uris: [{ uri: "https://example.com", match: UriMatchType.Host }] });
		expect(draft.login).not.toHaveProperty("password");
		expect(draft.login).not.toHaveProperty("totp");
	});

	it("maps fields with their original index and no hidden value", () => {
		const draft = itemToDraft(loginItem);

		expect(draft.fields).toEqual([
			{ originalIndex: 0, name: "pin", type: FieldType.Hidden },
			{ originalIndex: 1, name: "color", type: FieldType.Text, value: "blue" },
			{ originalIndex: 2, name: "linked", type: FieldType.Linked },
		]);
	});
});

describe("emptyDraft", () => {
	it("pre-fills the generated password of a login", () => {
		const draft = emptyDraft(CipherType.Login, { folderId: null, favorite: false, password: "secret" });

		expect(draft.login?.password).toEqual({ kind: "set", value: "secret" });
		expect(draft.fields).toEqual([]);
	});

	it("creates empty sections per type", () => {
		const identity = emptyDraft(CipherType.Identity, { folderId: "f", favorite: true });

		expect(identity.folderId).toBe("f");
		expect(identity.favorite).toBe(true);
		expect(identity.identity?.firstName).toBeNull();
		expect(emptyDraft(CipherType.Card, { folderId: null, favorite: false }).card?.brand).toBeNull();
		expect(emptyDraft(CipherType.SecureNote, { folderId: null, favorite: false }).login).toBeUndefined();
	});
});

describe("isDraftDirty", () => {
	it("is clean for an unchanged draft", () => {
		const initial = itemToDraft(loginItem);
		expect(isDraftDirty(initial, structuredClone(initial))).toBe(false);
	});

	it("detects a changed value", () => {
		const initial = itemToDraft(loginItem);
		const current = { ...initial, name: "Other" };
		expect(isDraftDirty(initial, current)).toBe(true);
	});

	it("treats a typed secret as a change", () => {
		const initial = itemToDraft(loginItem);
		const current = structuredClone(initial);
		current.login = { ...current.login!, password: { kind: "set", value: "new" } };
		expect(isDraftDirty(initial, current)).toBe(true);
	});

	it("does not flag a pre-generated password left as is", () => {
		const initial = emptyDraft(CipherType.Login, { folderId: null, favorite: false, password: "gen" });
		expect(isDraftDirty(initial, structuredClone(initial))).toBe(false);
	});
});

describe("draftErrors", () => {
	it("requires a name", () => {
		expect(draftErrors({ ...itemToDraft(loginItem), name: "   " }, false)).toBe("The name is required");
	});

	it("rejects an invalid TOTP and accepts a valid one", () => {
		const draft = itemToDraft(loginItem);
		expect(draftErrors({ ...draft, login: { ...draft.login!, totp: { kind: "set", value: "not base32!" } } }, false)).not.toBeNull();
		expect(draftErrors({ ...draft, login: { ...draft.login!, totp: { kind: "set", value: "JBSWY3DPEHPK3PXP" } } }, false)).toBeNull();
		expect(draftErrors({ ...draft, login: { ...draft.login!, totp: { kind: "clear" } } }, false)).toBeNull();
	});

	it("accepts a valid draft", () => {
		expect(draftErrors(itemToDraft(loginItem), false)).toBeNull();
	});

	it("requires a key to create an SSH key item, not to edit one", () => {
		const sshDraft = emptyDraft(CipherType.SshKey, { folderId: null, favorite: false });
		const named = { ...sshDraft, name: "Deploy" };

		expect(draftErrors(named, true)).toBe("Generate, import or paste an SSH key first");
		expect(draftErrors({ ...named, sshKey: { token: "t" } }, true)).toBeNull();
		expect(draftErrors(named, false)).toBeNull();
	});
});

describe("toSecretChange", () => {
	it("clears an empty text", () => {
		expect(toSecretChange("")).toEqual({ kind: "clear" });
		expect(toSecretChange("abc")).toEqual({ kind: "set", value: "abc" });
	});
});
