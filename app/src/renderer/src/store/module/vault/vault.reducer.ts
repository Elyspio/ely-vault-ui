import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { VaultSnapshot } from "@shared/types/vault.types";
import type { VaultFilter } from "./vault.search";
import { loadVault, syncVault } from "./vault.async.actions";
import { lock, logout, sessionStateChanged } from "@modules/session/session.async.actions";

export type VaultState = {
	snapshot: VaultSnapshot | null;
	filter: VaultFilter;
	query: string;
	selectedId: string | null;
	syncing: boolean;
};

const initialState: VaultState = {
	snapshot: null,
	filter: { kind: "all" },
	query: "",
	selectedId: null,
	syncing: false,
};

const slice = createSlice({
	name: "vault",
	initialState,
	reducers: {
		setFilter(state, action: PayloadAction<VaultFilter>) {
			state.filter = action.payload;
		},
		setQuery(state, action: PayloadAction<string>) {
			state.query = action.payload;
		},
		selectItem(state, action: PayloadAction<string | null>) {
			state.selectedId = action.payload;
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
			state.snapshot = action.payload;
			if (state.selectedId && !action.payload.items.some((item) => item.id === state.selectedId)) state.selectedId = null;
		});
		builder.addCase(syncVault.rejected, (state) => {
			state.syncing = false;
		});

		// Nothing of the vault stays in the renderer once locked
		const clear = () => initialState;
		builder.addCase(lock.pending, clear);
		builder.addCase(logout.pending, clear);
		builder.addCase(sessionStateChanged, (state, action) => (action.payload.status === "unlocked" ? state : initialState));
	},
});

export const { setFilter, setQuery, selectItem } = slice.actions;
export const vaultReducer = slice.reducer;
