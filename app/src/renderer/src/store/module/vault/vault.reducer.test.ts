import { describe, expect, it } from "vite-plus/test";
import { closeEditor, openEditor, resolveNavigation, selectItem, setEditorDirty, setFilter, vaultReducer, type VaultState } from "./vault.reducer";
import { updateItem } from "./vault.write.actions";
import { CipherType, type VaultItem, type VaultSnapshot, type WriteResult } from "@shared/types/vault.types";

const item = (id: string): VaultItem => ({
	id,
	type: CipherType.SecureNote,
	name: id,
	notes: null,
	favorite: false,
	reprompt: false,
	folderId: null,
	organizationId: null,
	collectionIds: [],
	revisionDate: "2026-10-10T12:00:00.000Z",
	creationDate: null,
	deletedDate: null,
	fields: [],
	passwordHistoryCount: 0,
});

const snapshot = (ids: string[]): VaultSnapshot => ({ items: ids.map(item), trash: [], folders: [], organizations: [], collections: [], lastSync: null });

function editing(dirty: boolean): VaultState {
	let state = vaultReducer(undefined, { type: "init" });
	state = { ...state, snapshot: snapshot(["a", "b"]) };
	state = vaultReducer(state, openEditor({ mode: "edit", itemId: "a", revision: "r1" }));
	return vaultReducer(state, setEditorDirty(dirty));
}

describe("vault reducer navigation guard", () => {
	it("selects another item and closes a clean editor", () => {
		const state = vaultReducer(editing(false), selectItem("b"));

		expect(state.selectedId).toBe("b");
		expect(state.editor).toBeNull();
	});

	it("keeps the dirty editor and waits for the user's choice", () => {
		const state = vaultReducer(editing(true), selectItem("b"));

		expect(state.selectedId).toBe("a");
		expect(state.editor).not.toBeNull();
		expect(state.pendingNavigation).toEqual({ kind: "select", itemId: "b" });
	});

	it("applies the pending navigation on discard", () => {
		let state = vaultReducer(editing(true), setFilter({ kind: "favorites" }));
		state = vaultReducer(state, resolveNavigation("discard"));

		expect(state.filter).toEqual({ kind: "favorites" });
		expect(state.editor).toBeNull();
		expect(state.editorDirty).toBe(false);
	});

	it("stays in the editor on cancel", () => {
		let state = vaultReducer(editing(true), closeEditor());
		state = vaultReducer(state, resolveNavigation("cancel"));

		expect(state.editor).not.toBeNull();
		expect(state.pendingNavigation).toBeNull();
		expect(state.editorDirty).toBe(true);
	});

	it("keeps the edited item selected when a reload no longer lists it", () => {
		const result: WriteResult = { outcome: { status: "conflict" }, snapshot: snapshot(["b"]), refreshError: null };
		const state = vaultReducer(editing(true), updateItem.fulfilled(result, "request", { itemId: "a", revision: "r1", draft: {} as never }));

		expect(state.snapshot?.items.map((i) => i.id)).toEqual(["b"]);
		expect(state.selectedId).toBe("a");
	});

	it("ignores a write result once the vault is locked", () => {
		const locked = vaultReducer(undefined, { type: "init" });
		const result: WriteResult = { outcome: { status: "success", id: "a" }, snapshot: snapshot(["a"]), refreshError: null };

		expect(vaultReducer(locked, updateItem.fulfilled(result, "request", { itemId: "a", revision: "r1", draft: {} as never })).snapshot).toBeNull();
	});
});
