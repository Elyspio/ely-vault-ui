import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Toast = {
	id: number;
	message: string;
	severity: "success" | "error" | "info";
};

export type UiState = {
	toast: Toast | null;
	paletteOpen: boolean;
	settingsOpen: boolean;
	generatorOpen: boolean;
};

const initialState: UiState = {
	toast: null,
	paletteOpen: false,
	settingsOpen: false,
	generatorOpen: false,
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
			prepare(message: string, severity: Toast["severity"] = "success") {
				return { payload: { id: ++toastId, message, severity } };
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
	},
});

export const { showToast, hideToast, setPaletteOpen, setSettingsOpen, setGeneratorOpen } = slice.actions;
export const uiReducer = slice.reducer;
