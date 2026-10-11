// Live write rules against a real Vaultwarden through `bw serve`. Opt-in: `pnpm test:live` (see docs/development/local-test-server.md).
// The tests run in order and share one account: every item and folder they create is removed in afterAll.
import type { BwFolder, BwItem } from "@main/modules/bitwarden/bw.types";
import { applyDraft, isConflictError, planFolderRename, validateDraft } from "@main/modules/vault/vault.writer";
import { convertSshKey, generateSshKey, type SshKeyMaterial } from "@main/modules/vault/ssh.keys";
import passkeyFixture from "@main/modules/vault/fixtures/login-passkey.json";
import { CipherType, FieldType, type ItemDraft, UriMatchType } from "@shared/types/vault.types";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { BwSession, type DevVault, draftFromItem, LIVE_HOOK_TIMEOUT, prepareLiveServer } from "./live.harness";

const names = {
	login: "Live login",
	ssh: "Live SSH key",
	trash: "Live trash item",
	folderA: "Live/A",
	folderAB: "Live/A/B",
};

let vault: DevVault;
let primary: BwSession;
let loginId = "";
let sshId = "";
const created = { items: [] as string[], folders: [] as string[] };

/** Plain login item draft with a single password, used when the test only needs an item */
function loginDraft(name: string): ItemDraft {
	return {
		type: CipherType.Login,
		name,
		notes: null,
		favorite: false,
		reprompt: false,
		folderId: null,
		fields: [],
		login: { username: null, uris: [], password: { kind: "set", value: "Trash-Passw0rd!" } },
	};
}

/** Creates an item through the same body the app would send and remembers it for cleanup */
async function createItem(draft: ItemDraft, sshKey: SshKeyMaterial | null = null): Promise<string> {
	const id = (await primary.request<BwItem>("POST", "/object/item", applyDraft(null, draft, sshKey))).id;
	created.items.push(id);
	// The created item reaches the local cache a moment later (see BwSession.read)
	await primary.get(id);
	return id;
}

beforeAll(async () => {
	vault = await prepareLiveServer();
	primary = await BwSession.open(vault);
}, LIVE_HOOK_TIMEOUT);

afterAll(async () => {
	const leftovers: string[] = [];
	try {
		if (primary) {
			// bw serve catches up with the server asynchronously: each removal is retried after a sync until the item is gone
			const present = async (id: string) => [...(await primary.itemIds()), ...(await primary.itemIds(true))].includes(id);
			for (const id of [...created.items].reverse()) {
				for (let attempt = 0; attempt < 5; attempt++) {
					await primary.send("POST", "/sync");
					if (!(await present(id))) break;
					await primary.send("DELETE", `/object/item/${id}`);
					await primary.send("DELETE", `/object/item/${id}?permanent=true`);
				}
				await primary.send("POST", "/sync");
				if (await present(id)) leftovers.push(`item ${id}`);
			}

			for (const id of [...created.folders].reverse()) {
				await primary.send("DELETE", `/object/folder/${id}`);
			}
			await primary.send("POST", "/sync");
			const folders = await primary.folders();
			for (const id of created.folders) {
				if (folders.some((folder) => folder.id === id)) leftovers.push(`folder ${id}`);
			}
		}
	} finally {
		await primary?.stop();
	}

	if (leftovers.length > 0) throw new Error(`Live test cleanup left objects behind: ${leftovers.join(", ")}`);
}, LIVE_HOOK_TIMEOUT);

describe("write rules against a live server", () => {
	it("creates a login with a passkey, a linked field, a hidden field and a text field", async () => {
		const draft: ItemDraft = {
			type: CipherType.Login,
			name: names.login,
			notes: null,
			favorite: false,
			reprompt: false,
			folderId: null,
			fields: [
				{ originalIndex: null, name: "Account", type: FieldType.Text, value: "octo" },
				{ originalIndex: null, name: "PIN", type: FieldType.Hidden, secret: { kind: "set", value: "1234" } },
			],
			login: {
				username: "live-user",
				uris: [{ uri: "https://live.example.test/login", match: UriMatchType.Host }],
				password: { kind: "set", value: "Old-Passw0rd!" },
			},
		};
		expect(validateDraft(null, draft, null)).toBeNull();

		// The app refuses to create linked fields (validateDraft), so the link is injected in the body
		const body = applyDraft(null, draft, null);
		const withPasskeyAndLink = {
			...body,
			login: { ...(body.login as object), fido2Credentials: passkeyFixture.login.fido2Credentials },
			fields: [...(body.fields as object[]), { name: "Login username", type: FieldType.Linked, value: null, linkedId: 100 }],
		};
		loginId = (await primary.request<BwItem>("POST", "/object/item", withPasskeyAndLink)).id;
		created.items.push(loginId);

		const stored = await primary.get(loginId);
		expect(stored.name).toBe(names.login);
		expect(stored.login?.fido2Credentials?.[0]).toMatchObject({ credentialId: "cred-1", rpId: "github.com" });
		expect(stored.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "Account", type: FieldType.Text, value: "octo" }),
				expect.objectContaining({ name: "PIN", type: FieldType.Hidden, value: "1234" }),
				expect.objectContaining({ name: "Login username", type: FieldType.Linked, linkedId: 100 }),
			])
		);
	});

	it("edits the login from a fresh copy: rename, username, reorder, new password, hidden value kept", async () => {
		const before = await primary.get(loginId);
		const beforeNames = (before.fields ?? []).map((field) => field.name);
		expect(beforeNames).toEqual(["Account", "PIN", "Login username"]);

		const draft = draftFromItem(before);
		const edited: ItemDraft = {
			...draft,
			name: "Live login renamed",
			// No password change on the hidden field: its secret is absent, so the value is kept
			login: { ...draft.login, username: "live-user-2", uris: draft.login?.uris ?? [], password: { kind: "set", value: "New-Passw0rd!" } },
			fields: [...draft.fields].reverse(),
		};
		expect(validateDraft(before, edited, null)).toBeNull();

		await primary.request("PUT", `/object/item/${loginId}`, applyDraft(before, edited, null));

		const after = await primary.get(loginId, (item) => item.name === "Live login renamed");
		expect(after.name).toBe("Live login renamed");
		expect(after.login?.username).toBe("live-user-2");
		expect(after.login?.password).toBe("New-Passw0rd!");
		expect(after.passwordHistory).toEqual(expect.arrayContaining([expect.objectContaining({ password: "Old-Passw0rd!" })]));
		expect(after.login?.fido2Credentials?.[0]).toMatchObject({ credentialId: "cred-1" });
		expect(after.login?.uris?.[0]).toMatchObject({ uri: "https://live.example.test/login", match: UriMatchType.Host });
		expect(after.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "Login username", type: FieldType.Linked, linkedId: 100 }),
				expect.objectContaining({ name: "PIN", type: FieldType.Hidden, value: "1234" }),
			])
		);
		expect((after.fields ?? []).map((field) => field.name)).toEqual([...beforeNames].reverse());
	});

	it("creates an SSH key item and keeps its key on a name-only edit", async () => {
		// Same path as the app: generated (or converted) key, then the item body built from it
		const key = generateSshKey();
		const converted = convertSshKey(key.privateKey, null);
		expect(converted).toMatchObject({ publicKey: key.publicKey, keyFingerprint: key.keyFingerprint });

		const draft: ItemDraft = {
			type: CipherType.SshKey,
			name: names.ssh,
			notes: null,
			favorite: false,
			reprompt: false,
			folderId: null,
			fields: [],
			sshKey: { token: "live-token" },
		};
		expect(validateDraft(null, draft, key)).toBeNull();
		sshId = await createItem(draft, key);

		const before = await primary.get(sshId);
		expect(before.sshKey).toEqual({ privateKey: key.privateKey, publicKey: key.publicKey, keyFingerprint: key.keyFingerprint });

		// Name-only edit: the draft carries no sshKey, so the original key stays
		const nameOnly: ItemDraft = { ...draftFromItem(before), name: "Live SSH key renamed" };
		expect(validateDraft(before, nameOnly, null)).toBeNull();
		await primary.request("PUT", `/object/item/${sshId}`, applyDraft(before, nameOnly, null));

		const after = await primary.get(sshId, (item) => item.name === "Live SSH key renamed");
		expect(after.name).toBe("Live SSH key renamed");
		expect(after.sshKey).toEqual({ privateKey: key.privateKey, publicKey: key.publicKey, keyFingerprint: key.keyFingerprint });
	});

	it("refuses an edit made from a stale copy and accepts it after a sync", async () => {
		// Second device, same account: it edits the login first
		const other = await BwSession.open(vault);
		try {
			const otherCopy = await other.get(loginId);
			await other.request("PUT", `/object/item/${loginId}`, applyDraft(otherCopy, { ...draftFromItem(otherCopy), name: "Live from device B" }, null));

			// First server still has the revision it synced before: its edit must not be written
			const stale = await primary.get(loginId);
			const rejected = await primary.send("PUT", `/object/item/${loginId}`, applyDraft(stale, { ...draftFromItem(stale), name: "Live from device A" }, null));
			expect(rejected.success).toBe(false);
			if (rejected.success) return;
			expect(isConflictError(rejected.message)).toBe(true);
			expect((await primary.get(loginId)).name).toBe("Live login renamed");

			await primary.request("POST", "/sync");
			const fresh = await primary.get(loginId, (item) => item.name === "Live from device B");
			expect(fresh.name).toBe("Live from device B");
			await primary.request("PUT", `/object/item/${loginId}`, applyDraft(fresh, { ...draftFromItem(fresh), name: "Live from device A after sync" }, null));
			expect((await primary.get(loginId, (item) => item.name === "Live from device A after sync")).name).toBe("Live from device A after sync");
		} finally {
			await other.stop();
		}
	});

	it("soft deletes, restores and permanently deletes an item", async () => {
		const id = await createItem(loginDraft(names.trash));

		await primary.request("DELETE", `/object/item/${id}`);
		expect(await primary.itemIds(true, (ids) => ids.includes(id))).toContain(id);
		expect(await primary.itemIds(false, (ids) => !ids.includes(id))).not.toContain(id);

		await primary.request("POST", `/restore/item/${id}`);
		expect(await primary.itemIds(false, (ids) => ids.includes(id))).toContain(id);
		expect(await primary.itemIds(true, (ids) => !ids.includes(id))).not.toContain(id);

		await primary.request("DELETE", `/object/item/${id}`);
		await primary.request("DELETE", `/object/item/${id}?permanent=true`);
		expect(await primary.itemIds(true, (ids) => !ids.includes(id))).not.toContain(id);
		expect(await primary.itemIds(false, (ids) => !ids.includes(id))).not.toContain(id);
		expect((await primary.send("GET", `/object/item/${id}`)).success).toBe(false);
	});

	it("renames a folder tree with the planned cascade and deletes it children first", async () => {
		const parent = await primary.request<BwFolder & { id: string }>("POST", "/object/folder", { name: names.folderA });
		created.folders.push(parent.id);
		const child = await primary.request<BwFolder & { id: string }>("POST", "/object/folder", { name: names.folderAB });
		created.folders.push(child.id);

		const folders = await primary.folders();
		const plan = planFolderRename(folders, "Live/A", "Live/Z");
		if ("error" in plan) throw new Error(plan.error);
		expect(plan.renames).toEqual([
			{ id: parent.id, name: "Live/Z" },
			{ id: child.id, name: "Live/Z/B" },
		]);

		for (const rename of plan.renames) {
			await primary.request("PUT", `/object/folder/${rename.id}`, { name: rename.name });
		}
		const renamed = await primary.folders((list) => list.some((folder) => folder.name === "Live/Z/B"));
		const renamedNames = renamed.map((folder) => folder.name);
		expect(renamedNames).toEqual(expect.arrayContaining(["Live/Z", "Live/Z/B"]));
		expect(renamedNames).not.toContain("Live/A");
		expect(renamedNames).not.toContain("Live/A/B");

		await primary.request("DELETE", `/object/folder/${child.id}`);
		await primary.request("DELETE", `/object/folder/${parent.id}`);
		const remaining = (await primary.folders((list) => list.every((folder) => folder.id !== child.id && folder.id !== parent.id))).map((folder) => folder.id);
		expect(remaining).not.toContain(parent.id);
		expect(remaining).not.toContain(child.id);
		created.folders.length = 0;
	});
});
