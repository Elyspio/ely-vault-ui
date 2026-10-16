import { createSlice, isFulfilled, type PayloadAction } from "@reduxjs/toolkit";
import type { CipherType, VaultSnapshot } from "@shared/types/vault.types";
import type { VaultFilter } from "./vault.search";
import { loadVault, syncVault } from "./vault.async.actions";
import { writeThunks } from "./vault.write.actions";
import { lock, logout, sessionStateChanged } from "@modules/session/session.async.actions";

/** Item open in the editor of the detail panel. The draft itself stays in the editor component (it may hold secrets). */
export type EditorState =
	/** `revision`: revision of the item when the editor opened it, sent back to detect a conflict */
	{ mode: "edit"; itemId: string; revision: string } | { mode: "create"; type: CipherType };

/** Navigation asked while the editor has unsaved changes, applied once they are saved or discarded */
export type PendingNavigation = { kind: "select"; itemId: string | null } | { kind: "filter"; filter: VaultFilter } | { kind: "close" };

export type VaultState = {
	snapshot: VaultSnapshot | null;
	filter: VaultFilter;
	query: string;
	selectedId: string | null;
	syncing: boolean;
	editor: EditorState | null;
	/** The editor has changes not saved yet */
	editorDirty: boolean;
	pendingNavigation: PendingNavigation | null;
};

const initialState: VaultState = {
	snapshot: null,
	filter: { kind: "all" },
	query: "",
	selectedId: null,
	syncing: false,
	editor: null,
	editorDirty: false,
	pendingNavigation: null,
};

/**
 * Applies a navigation; leaving the edited item closes the editor
 */
function navigate(state: VaultState, navigation: PendingNavigation) {
	switch (navigation.kind) {
		case "select":
			if (state.editor && !(state.editor.mode === "edit" && state.editor.itemId === navigation.itemId)) closeEditorState(state);
			state.selectedId = navigation.itemId;
			break;
		case "filter":
			closeEditorState(state);
			state.filter = navigation.filter;
			break;
		case "close":
			closeEditorState(state);
			break;
	}
}

function closeEditorState(state: VaultState) {
	state.editor = null;
	state.editorDirty = false;
	state.pendingNavigation = null;
}

/**
 * Every navigation goes through here: with unsaved changes it waits for the user's choice (save / discard / cancel)
 */
function guard(state: VaultState, navigation: PendingNavigation) {
	if (state.editor && state.editorDirty) state.pendingNavigation = navigation;
	else navigate(state, navigation);
}

const slice = createSlice({
	name: "vault",
	initialState,
	reducers: {
		backgroundSnapshot(state, action: PayloadAction<VaultSnapshot>) {
			if (!state.snapshot) return;
			state.snapshot = action.payload;
			keepSelection(state);
		},
		setFilter(state, action: PayloadAction<VaultFilter>) {
			guard(state, { kind: "filter", filter: action.payload });
		},
		setQuery(state, action: PayloadAction<string>) {
			state.query = action.payload;
		},
		selectItem(state, action: PayloadAction<string | null>) {
			if (action.payload === state.selectedId) return;
			guard(state, { kind: "select", itemId: action.payload });
		},
		openEditor(state, action: PayloadAction<EditorState>) {
			state.editor = action.payload;
			state.editorDirty = false;
			state.pendingNavigation = null;
			if (action.payload.mode === "edit") state.selectedId = action.payload.itemId;
		},
		/** Closes the editor, asking first when it has unsaved changes */
		closeEditor(state) {
			guard(state, { kind: "close" });
		},
		setEditorDirty(state, action: PayloadAction<boolean>) {
			state.editorDirty = action.payload;
		},
		/**
		 * Answer to the unsaved changes question: "discard" (or "saved" once the editor saved) applies the pending
		 * navigation, "cancel" stays in the editor
		 */
		resolveNavigation(state, action: PayloadAction<"saved" | "discard" | "cancel">) {
			const pending = state.pendingNavigation;
			state.pendingNavigation = null;
			if (!pending || action.payload === "cancel") return;
			state.editorDirty = false;
			navigate(state, pending);
		},
	},
	extraReducers: (builder) => {
		builder.addCase(loadVault.fulfilled, (state, action) => {
			state.snapshot = action.payload;
		});
		builder.addCase(syncVault.pending, (state) => {
			state.syncing = true;
		});
		builder.addCase(syncVault.fulfilled, (state, action) => {
			state.syncing = false;
			// The vault may have been locked while the sync was running: its result must not reopen it
			if (state.snapshot === null) return;
			state.snapshot = action.payload;
			keepSelection(state);
		});
		builder.addCase(syncVault.rejected, (state) => {
			state.syncing = false;
		});

		// Nothing of the vault stays in the renderer once locked
		const clear = () => initialState;
		builder.addCase(lock.pending, clear);
		builder.addCase(logout.pending, clear);
		builder.addCase(sessionStateChanged, (state, action) => (action.payload.status === "unlocked" ? state : initialState));

		// Every write reloads the vault: its snapshot replaces the current one (null when the reload failed)
		builder.addMatcher(isFulfilled(...writeThunks), (state, action) => {
			if (state.snapshot === null || action.payload.snapshot === null) return;
			state.snapshot = action.payload.snapshot;
			keepSelection(state);
		});
	},
});

/**
 * The selection follows a reloaded vault: an item that disappeared (deleted elsewhere) is deselected, unless it is being edited
 */
function keepSelection(state: VaultState) {
	const snapshot = state.snapshot;
	if (!snapshot || !state.selectedId) return;
	const exists = snapshot.items.some((item) => item.id === state.selectedId) || snapshot.trash.some((item) => item.id === state.selectedId);
	if (!exists && !(state.editor?.mode === "edit" && state.editor.itemId === state.selectedId)) state.selectedId = null;
}

export const { backgroundSnapshot, setFilter, setQuery, selectItem, openEditor, closeEditor, setEditorDirty, resolveNavigation } = slice.actions;
export const vaultReducer = slice.reducer;
