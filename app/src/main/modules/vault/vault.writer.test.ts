import { describe, expect, it } from "vite-plus/test";
import { applyDraft, checkFolderDelete, isConflictError, isValidTotp, planFolderRename, validateDraft } from "./vault.writer";
import type { BwField, BwFolder, BwItem } from "../bitwarden/bw.types";
import { CipherType, type DraftField, FieldType, type ItemDraft } from "@shared/types/vault.types";
import loginFixture from "./fixtures/login-passkey.json";
import orgFixture from "./fixtures/org-redacted.json";
import cardFixture from "./fixtures/card.json";
import sshFixture from "./fixtures/ssh-key.json";
import noteFixture from "./fixtures/secure-note.json";
import type { SshKeyMaterial } from "./ssh.keys";

/** Fresh copy of a fixture, typed as the decrypted item returned by `bw serve` */
function item(json: unknown): BwItem {
	return structuredClone(json) as BwItem;
}

/** Key the main process holds for a draft (its token is what the renderer sends) */
const NEW_KEY: SshKeyMaterial = { privateKey: "PRIVATE", publicKey: "ssh-ed25519 NEW", keyFingerprint: "SHA256:new", keyType: "ssh-ed25519" };

/** Draft the renderer would send for an unchanged item: secrets are absent, hidden values are unknown */
function draftOf(original: BwItem): ItemDraft {
	return {
		type: original.type as CipherType,
		name: original.name,
		notes: original.notes ?? null,
		favorite: original.favorite,
		reprompt: original.reprompt === 1,
		folderId: original.folderId,
		fields: (original.fields ?? []).map((field, index) => draftFieldOf(field, index)),
		login: original.login && {
			username: original.login.username,
			uris: (original.login.uris ?? []).map((uri) => ({ uri: uri.uri ?? "", match: uri.match ?? null })),
		},
		card: original.card && {
			cardholderName: original.card.cardholderName,
			brand: original.card.brand,
			expMonth: original.card.expMonth,
			expYear: original.card.expYear,
		},
	};
}

function draftFieldOf(field: BwField, index: number): DraftField {
	const type = field.type as FieldType;
	return {
		originalIndex: index,
		name: field.name ?? "",
		type,
		...(type === FieldType.Hidden ? {} : { value: field.value }),
	};
}

function draftWith(base: Partial<ItemDraft>): ItemDraft {
	return {
		type: CipherType.Login,
		name: "Item",
		notes: null,
		favorite: false,
		reprompt: false,
		folderId: null,
		fields: [],
		login: { username: null, uris: [] },
		...base,
	};
}

const folders: BwFolder[] = [
	{ id: null, name: "No folder" },
	{ id: "f-work", name: "Work" },
	{ id: "f-proj", name: "Work/Projects" },
	{ id: "f-deep", name: "Work/Projects/2026" },
	{ id: "f-archive", name: "Work Archive" },
	{ id: "f-personal", name: "Personal" },
];

describe("applyDraft on edit", () => {
	it("keeps the properties the app does not manage (passkeys, keys, history, linked fields)", () => {
		const original = item(loginFixture);
		const body = applyDraft(original, { ...draftOf(original), name: "GitHub work" }, null);

		expect(body.login).toMatchObject({ fido2Credentials: original.login!.fido2Credentials, passwordRevisionDate: "2026-09-01T10:00:00.000Z" });
		expect(body.passwordHistory).toEqual(original.passwordHistory);
		expect(body.key).toBe(original.key);
		expect(body.revisionDate).toBe(original.revisionDate);
		expect(body.collectionIds).toEqual(original.collectionIds);
		expect(body.fields).toEqual([
			{ name: "Recovery code", type: FieldType.Hidden, value: "a1b2-c3d4", linkedId: null },
			{ name: "Account", type: FieldType.Text, value: "octocat", linkedId: null },
			{ name: "Username", type: FieldType.Linked, value: null, linkedId: 100 },
		]);
		expect(Object.keys(body).sort()).toEqual(Object.keys(original).sort());
	});

	it("applies the managed properties", () => {
		const original = item(loginFixture);
		const body = applyDraft(
			original,
			draftWith({ type: CipherType.Login, name: "  GitHub work  ", notes: "", favorite: false, reprompt: false, folderId: "3a4b5c6d-0000-4000-8000-000000000002" }),
			null
		);

		expect(body).toMatchObject({ name: "GitHub work", notes: null, favorite: false, reprompt: 0, folderId: "3a4b5c6d-0000-4000-8000-000000000002" });
	});

	it("keeps the secrets when the draft does not change them", () => {
		const original = item(loginFixture);
		const body = applyDraft(original, draftOf(original), null);

		expect(body.login).toMatchObject({ password: "hunter2-password", totp: "JBSWY3DPEHPK3PXP" });
	});

	it("sets and clears secrets", () => {
		const original = item(loginFixture);
		const set = applyDraft(original, { ...draftOf(original), login: { username: "octocat", uris: [], password: { kind: "set", value: "new-pass" } } }, null);
		const cleared = applyDraft(original, { ...draftOf(original), login: { username: "octocat", uris: [], totp: { kind: "clear" } } }, null);

		expect(set.login).toMatchObject({ password: "new-pass", totp: "JBSWY3DPEHPK3PXP" });
		expect(cleared.login).toMatchObject({ password: "hunter2-password", totp: null });
	});

	it("keeps the uri match and drops the empty uris", () => {
		const original = item(loginFixture);
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				login: {
					username: "octocat",
					uris: [
						{ uri: "  https://github.com/login ", match: 0 },
						{ uri: "   ", match: 3 },
						{ uri: "https://gist.github.com/", match: 3 },
					],
				},
			},
			null
		);

		expect(body.login).toMatchObject({
			uris: [
				{ uri: "https://github.com/login", match: 0 },
				{ uri: "https://gist.github.com/", match: 3 },
			],
		});
	});

	it("turns an empty username into null", () => {
		const original = item(loginFixture);
		const body = applyDraft(original, { ...draftOf(original), login: { username: "", uris: [] } }, null);

		expect(body.login).toMatchObject({ username: null });
	});

	it("rebuilds the fields in draft order: reorder, remove and add", () => {
		const original = item(loginFixture);
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				fields: [
					{ originalIndex: 1, name: "Account", type: FieldType.Text, value: "octocat2" },
					{ originalIndex: null, name: "Note", type: FieldType.Text, value: "x" },
					{ originalIndex: 0, name: "Recovery code", type: FieldType.Hidden },
				],
			},
			null
		);

		expect(body.fields).toEqual([
			{ name: "Account", type: FieldType.Text, value: "octocat2", linkedId: null },
			{ name: "Note", type: FieldType.Text, value: "x", linkedId: null },
			{ name: "Recovery code", type: FieldType.Hidden, value: "a1b2-c3d4", linkedId: null },
		]);
	});

	it("sets, clears or keeps hidden field values", () => {
		const original = item(loginFixture);
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				fields: [
					{ originalIndex: 0, name: "Recovery code", type: FieldType.Hidden, secret: { kind: "clear" } },
					{ originalIndex: null, name: "PIN", type: FieldType.Hidden, secret: { kind: "set", value: "0000" } },
					{ originalIndex: null, name: "Empty PIN", type: FieldType.Hidden },
				],
			},
			null
		);

		expect(body.fields).toEqual([
			{ name: "Recovery code", type: FieldType.Hidden, value: null, linkedId: null },
			{ name: "PIN", type: FieldType.Hidden, value: "0000", linkedId: null },
			{ name: "Empty PIN", type: FieldType.Hidden, value: null, linkedId: null },
		]);
	});

	it("keeps a linked field value and link when its name changes", () => {
		const original = item(loginFixture);
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				fields: [{ originalIndex: 2, name: "Login name", type: FieldType.Linked }],
			},
			null
		);

		expect(body.fields).toEqual([{ name: "Login name", type: FieldType.Linked, value: null, linkedId: 100 }]);
	});

	it("keeps the SSH key on a name-only edit and replaces it when the draft provides one", () => {
		const original = item(sshFixture);
		const renamed = applyDraft(original, { ...draftOf(original), name: "Deploy key 2" }, null);
		const replaced = applyDraft(original, draftOf(original), NEW_KEY);

		expect(renamed.sshKey).toEqual(original.sshKey);
		expect(replaced.sshKey).toEqual({ privateKey: "PRIVATE", publicKey: "ssh-ed25519 NEW", keyFingerprint: "SHA256:new" });
	});

	it("updates a card: an absent number is kept, a code is replaced", () => {
		const original = item(cardFixture);
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				card: { cardholderName: "JEAN", brand: "", expMonth: "08", expYear: "2030", code: { kind: "set", value: "999" } },
			},
			null
		);

		expect(body.card).toEqual({
			cardholderName: "JEAN",
			brand: null,
			number: "4111111111111111",
			expMonth: "08",
			expYear: "2030",
			code: "999",
		});
	});

	it("merges the identity draft over the original identity and keeps unknown keys", () => {
		const original = item({ ...noteFixture, type: CipherType.Identity, identity: { firstName: "Jean", lastName: "Dupont", ssn: "123", extra: "kept" } });
		const body = applyDraft(
			original,
			{
				...draftOf(original),
				type: CipherType.Identity,
				login: undefined,
				identity: { firstName: "Jeanne", lastName: "", email: "j@example.com" } as ItemDraft["identity"],
			},
			null
		);

		expect(body.identity).toEqual({ firstName: "Jeanne", lastName: null, ssn: "123", extra: "kept", email: "j@example.com" });
	});

	it("keeps the original section when the draft has none for the item type", () => {
		const original = item(cardFixture);
		const body = applyDraft(original, { ...draftOf(original), card: undefined }, null);

		expect(body.card).toEqual(original.card);
	});
});

describe("applyDraft on create", () => {
	it("builds a login body with defaults", () => {
		const body = applyDraft(
			null,
			draftWith({
				type: CipherType.Login,
				name: " New ",
				notes: "",
				favorite: true,
				reprompt: true,
				login: { username: "", uris: [{ uri: "https://example.com", match: null }] },
			}),
			null
		);

		expect(body).toEqual({
			type: CipherType.Login,
			name: "New",
			notes: null,
			favorite: true,
			reprompt: 1,
			folderId: null,
			organizationId: null,
			collectionIds: [],
			fields: [],
			login: {
				username: null,
				uris: [{ uri: "https://example.com", match: null }],
				password: null,
				totp: null,
				fido2Credentials: [],
			},
		});
	});

	it("builds a secure note with its section", () => {
		const body = applyDraft(null, draftWith({ type: CipherType.SecureNote, name: "Note", login: undefined, notes: "Text" }), null);

		expect(body).toMatchObject({ type: CipherType.SecureNote, notes: "Text", secureNote: { type: 0 } });
		expect(body.login).toBeUndefined();
	});

	it("builds a card with the secret only when set", () => {
		const body = applyDraft(
			null,
			draftWith({
				type: CipherType.Card,
				login: undefined,
				card: { cardholderName: "JEAN", brand: "Visa", expMonth: "08", expYear: "2029", number: { kind: "set", value: "4111111111111111" } },
			}),
			null
		);

		expect(body.card).toEqual({ cardholderName: "JEAN", brand: "Visa", expMonth: "08", expYear: "2029", number: "4111111111111111", code: null });
	});

	it("builds an identity with empty values as null", () => {
		const body = applyDraft(null, draftWith({ type: CipherType.Identity, login: undefined, identity: { firstName: "Jean", lastName: "" } as ItemDraft["identity"] }), null);

		expect(body.identity).toMatchObject({ firstName: "Jean", lastName: null, title: null, email: null });
	});

	it("builds an SSH key with its three values", () => {
		const body = applyDraft(null, draftWith({ type: CipherType.SshKey, login: undefined }), NEW_KEY);

		expect(body.sshKey).toEqual({ privateKey: "PRIVATE", publicKey: "ssh-ed25519 NEW", keyFingerprint: "SHA256:new" });
	});

	it("creates new hidden fields with their secret", () => {
		const body = applyDraft(null, draftWith({ fields: [{ originalIndex: null, name: "PIN", type: FieldType.Hidden, secret: { kind: "set", value: "1234" } }] }), null);

		expect(body.fields).toEqual([{ name: "PIN", type: FieldType.Hidden, value: "1234", linkedId: null }]);
	});
});

describe("validateDraft", () => {
	it("accepts an unchanged item", () => {
		const original = item(loginFixture);
		expect(validateDraft(original, draftOf(original), null)).toBeNull();
	});

	it("refuses an empty name", () => {
		expect(validateDraft(null, draftWith({ name: "   " }), null)).toBe("The name is required");
	});

	it("refuses an unknown type on create", () => {
		expect(validateDraft(null, draftWith({ type: 6 as CipherType }), null)).toBe("Unsupported item type");
	});

	it("requires a key on create, and accepts one", () => {
		const draft = draftWith({ type: CipherType.SshKey, login: undefined });
		expect(validateDraft(null, draft, null)).toBe("An SSH key is required: generate, import or paste one");
		expect(validateDraft(null, draft, NEW_KEY)).toBeNull();
	});

	it("refuses to edit an item of another type than 1 to 5", () => {
		const original = { ...item(loginFixture), type: 6 };
		expect(validateDraft(original, draftOf(original), null)).toBe("This item type cannot be edited");
	});

	it("refuses a type change", () => {
		const original = item(loginFixture);
		expect(validateDraft(original, { ...draftOf(original), type: CipherType.SecureNote }, null)).toBe("The item type cannot change");
	});

	it("refuses to edit a deleted item", () => {
		const original = { ...item(loginFixture), deletedDate: "2026-10-09T08:00:00.000Z" };
		expect(validateDraft(original, draftOf(original), null)).toBe("Restore the item before editing it");
	});

	it("refuses unknown or duplicated original field indexes", () => {
		const original = item(loginFixture);
		const draft = draftOf(original);

		expect(validateDraft(original, { ...draft, fields: [{ originalIndex: 7, name: "x", type: FieldType.Text, value: "" }] }, null)).toBe(
			"A custom field refers to a field that does not exist"
		);
		expect(
			validateDraft(
				original,
				{
					...draft,
					fields: [
						{ originalIndex: 1, name: "Account", type: FieldType.Text, value: "a" },
						{ originalIndex: 1, name: "Copy", type: FieldType.Text, value: "a" },
					],
				},
				null
			)
		).toBe("A custom field is listed more than once");
	});

	it("refuses a new linked field and a linked field changing type", () => {
		const original = item(loginFixture);
		const draft = draftOf(original);

		expect(validateDraft(original, { ...draft, fields: [{ originalIndex: null, name: "Link", type: FieldType.Linked }] }, null)).toBe("Linked fields cannot be created");
		expect(validateDraft(original, { ...draft, fields: [{ originalIndex: 2, name: "Username", type: FieldType.Text, value: "" }] }, null)).toBe(
			"Linked fields keep their type"
		);
	});

	it("validates the TOTP secret", () => {
		const original = item(loginFixture);
		const draft = draftOf(original);
		const withTotp = (value: string) => ({ ...draft, login: { username: "octocat", uris: [], totp: { kind: "set" as const, value } } });

		expect(validateDraft(original, withTotp("not a secret!"), null)).toBe("Invalid TOTP secret");
		expect(validateDraft(original, withTotp("otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=1"), null)).toBe("Invalid TOTP secret");
		expect(validateDraft(original, withTotp("JBSWY3DPEHPK3PXP"), null)).toBeNull();
		expect(validateDraft(original, { ...draft, login: { username: "octocat", uris: [], totp: { kind: "clear" } } }, null)).toBeNull();
	});

	describe("redacted organization items", () => {
		const original = item(orgFixture);
		// Fields: 0 PIN (hidden, redacted), 1 Owner, 2 PIN (hidden, redacted), 3 Token (hidden, redacted)
		const draft = draftOf(original);

		it("accepts the draft as is", () => {
			expect(validateDraft(original, draft, null)).toBeNull();
		});

		it("refuses to rename a redacted hidden field", () => {
			const fields = [...draft.fields];
			fields[0] = { ...fields[0], name: "Pin code" };

			expect(validateDraft(original, { ...draft, fields }, null)).toMatch(/Hidden fields protected by the organization/);
		});

		it("refuses to remove a redacted hidden field", () => {
			expect(validateDraft(original, { ...draft, fields: draft.fields.filter((field) => field.originalIndex !== 3) }, null)).toMatch(/Hidden fields protected/);
		});

		it("refuses to reorder same-named redacted fields", () => {
			const swapped = [draft.fields[2], draft.fields[1], draft.fields[0], draft.fields[3]];

			expect(validateDraft(original, { ...draft, fields: swapped }, null)).toMatch(/Hidden fields protected/);
		});

		it("allows reordering unrelated fields", () => {
			const reordered = [draft.fields[1], draft.fields[0], draft.fields[2], draft.fields[3]];

			expect(validateDraft(original, { ...draft, fields: reordered }, null)).toBeNull();
		});

		it("allows changing the value of a redacted field without same-named fields", () => {
			const fields = [...draft.fields];
			fields[3] = { ...fields[3], secret: { kind: "set", value: "new-token" } };

			expect(validateDraft(original, { ...draft, fields }, null)).toBeNull();
		});

		it("refuses a value change on one of several same-named redacted fields", () => {
			const fields = [...draft.fields];
			fields[0] = { ...fields[0], secret: { kind: "set", value: "4242" } };

			expect(validateDraft(original, { ...draft, fields }, null)).toMatch(/Hidden fields protected/);
		});

		it("refuses a new field named like a redacted field", () => {
			const fields = [...draft.fields, { originalIndex: null, name: "Token", type: FieldType.Hidden }];

			expect(validateDraft(original, { ...draft, fields }, null)).toMatch(/Hidden fields protected/);
		});

		it("does not apply the guard to personal items", () => {
			const personal = { ...item(loginFixture), organizationId: null };
			const draftPersonal = draftOf(personal);
			const fields = [...draftPersonal.fields];
			fields[0] = { ...fields[0], name: "Renamed" };

			expect(validateDraft(personal, { ...draftPersonal, fields }, null)).toBeNull();
		});
	});
});

describe("isValidTotp", () => {
	it.each([
		["JBSWY3DPEHPK3PXP", true],
		["jbsw y3dp ehpk 3pxp====", true],
		["JBSWY3DP", false],
		["JBSWY3DPEHPK3PX1", false],
		["otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub", true],
		["otpauth://totp/x?issuer=y", false],
		["otpauth://totp/x?secret=abc", false],
		["otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=1", false],
		["steam://JBSWY3DPEHPK3PXP", true],
		["steam://abc", false],
		["garbage!!", false],
	])("%s -> %s", (value, valid) => {
		expect(isValidTotp(value)).toBe(valid);
	});
});

describe("isConflictError", () => {
	it("detects the stale copy error of the server", () => {
		expect(isConflictError("The client copy of this cipher is out of date. Resync the client and try again.")).toBe(true);
		expect(isConflictError("You do not have permission to edit this item")).toBe(false);
	});
});

describe("planFolderRename", () => {
	it("renames the folder and its descendants, parents first", () => {
		expect(planFolderRename(folders, "Work", "Job")).toEqual({
			renames: [
				{ id: "f-work", name: "Job" },
				{ id: "f-proj", name: "Job/Projects" },
				{ id: "f-deep", name: "Job/Projects/2026" },
			],
		});
	});

	it("does not touch a folder whose name only starts with the same text", () => {
		const result = planFolderRename(folders, "Work", "Job");
		expect("renames" in result && result.renames.map((rename) => rename.id)).not.toContain("f-archive");
	});

	it("moves a nested folder", () => {
		expect(planFolderRename(folders, "Work/Projects", "Archive/Projects")).toEqual({
			renames: [
				{ id: "f-proj", name: "Archive/Projects" },
				{ id: "f-deep", name: "Archive/Projects/2026" },
			],
		});
	});

	it("renames a virtual parent through its children", () => {
		const virtual: BwFolder[] = [{ id: "x", name: "A/B/C" }];

		expect(planFolderRename(virtual, "A", "Z")).toEqual({ renames: [{ id: "x", name: "Z/B/C" }] });
		expect(planFolderRename(virtual, "A/B", "A/Q")).toEqual({ renames: [{ id: "x", name: "A/Q/C" }] });
	});

	it("normalizes the new path", () => {
		expect(planFolderRename([{ id: "f-personal", name: "Personal" }], "Personal", " Private / ")).toEqual({
			renames: [{ id: "f-personal", name: "Private" }],
		});
	});

	it("refuses an empty new path", () => {
		expect(planFolderRename(folders, "Work", "  /  ")).toEqual({ error: "The new folder name is empty" });
	});

	it("refuses the same name", () => {
		expect(planFolderRename(folders, "Work", "Work/")).toEqual({ error: "The new name is the same as the current one" });
	});

	it("refuses to move a folder inside itself", () => {
		expect(planFolderRename(folders, "Work", "Work/Sub")).toEqual({ error: "A folder cannot be moved inside itself" });
	});

	it("refuses a folder that does not exist under the path", () => {
		expect(planFolderRename(folders, "Nothing", "Other")).toEqual({ error: 'No folder under "Nothing"' });
	});

	it("ignores the virtual No folder entry", () => {
		expect(planFolderRename(folders, "No folder", "Other")).toEqual({ error: 'No folder under "No folder"' });
	});

	it("refuses a new name colliding with a folder that is not renamed", () => {
		expect(planFolderRename(folders, "Work", "Personal")).toEqual({ error: 'A folder named "Personal" already exists' });
		expect(planFolderRename(folders, "Work/Projects", "Work Archive")).toEqual({ error: 'A folder named "Work Archive" already exists' });
	});
});

describe("checkFolderDelete", () => {
	const activeItem = item({ ...loginFixture, folderId: "f-personal" });

	it("refuses an unknown folder", () => {
		expect(checkFolderDelete(folders, [], "missing")).toBe("Folder not found");
	});

	it("refuses a folder with active items", () => {
		expect(checkFolderDelete(folders, [activeItem], "f-personal")).toBe("Move or delete its items first");
	});

	it("allows a folder whose items are only in the trash (caller excludes them)", () => {
		expect(checkFolderDelete(folders, [], "f-personal")).toBeNull();
	});

	it("refuses a folder with sub folders", () => {
		expect(checkFolderDelete(folders, [], "f-work")).toBe("Delete its sub folders first");
		expect(checkFolderDelete(folders, [], "f-proj")).toBe("Delete its sub folders first");
	});

	it("allows a folder that only shares the start of its name with another", () => {
		expect(
			checkFolderDelete(
				[
					{ id: "f-work", name: "Work" },
					{ id: "f-archive", name: "Work Archive" },
				],
				[],
				"f-work"
			)
		).toBeNull();
	});
});
