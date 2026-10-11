import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PasswordGeneratorOptions } from "@shared/types/vault.types";

/** Action button of a toast (serializable: the Toaster runs it) */
export type ToastAction = { label: string; kind: "restore-item"; itemId: string };

export type Toast = {
	id: number;
	message: string;
	severity: "success" | "error" | "info";
	action?: ToastAction;
};

export type UiState = {
	toast: Toast | null;
	paletteOpen: boolean;
	settingsOpen: boolean;
	generatorOpen: boolean;
	/** Type picker of a new item */
	newItemOpen: boolean;
	/** Last options of the generator, reused by the generator dialog and the item editor */
	generatorOptions: PasswordGeneratorOptions;
};

const initialState: UiState = {
	toast: null,
	paletteOpen: false,
	settingsOpen: false,
	generatorOpen: false,
	newItemOpen: false,
	generatorOptions: { mode: "password", length: 24, special: true },
};

let toastId = 0;

const slice = createSlice({
	name: "ui",
	initialState,
	reducers: {
		showToast: {
			reducer(state, action: PayloadAction<Toast>) {
				state.toast = action.payload;
			},
			prepare(message: string, severity: Toast["severity"] = "success", action?: ToastAction) {
				return { payload: { id: ++toastId, message, severity, action } };
			},
		},
		hideToast(state, action: PayloadAction<number>) {
			if (state.toast?.id === action.payload) state.toast = null;
		},
		setPaletteOpen(state, action: PayloadAction<boolean>) {
			state.paletteOpen = action.payload;
		},
		setSettingsOpen(state, action: PayloadAction<boolean>) {
			state.settingsOpen = action.payload;
		},
		setGeneratorOpen(state, action: PayloadAction<boolean>) {
			state.generatorOpen = action.payload;
		},
		setNewItemOpen(state, action: PayloadAction<boolean>) {
			state.newItemOpen = action.payload;
		},
		setGeneratorOptions(state, action: PayloadAction<PasswordGeneratorOptions>) {
			state.generatorOptions = action.payload;
		},
	},
});

export const { showToast, hideToast, setPaletteOpen, setSettingsOpen, setGeneratorOpen, setNewItemOpen, setGeneratorOptions } = slice.actions;
export const uiReducer = slice.reducer;

/**
 * A dialog covers the vault screen: its window shortcuts (vault and editor) stand aside
 */
export const selectModalOpen = (state: { ui: UiState }) => state.ui.paletteOpen || state.ui.settingsOpen || state.ui.generatorOpen || state.ui.newItemOpen;
