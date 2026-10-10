import { createSlice } from "@reduxjs/toolkit";
import { type AppConfig, defaultAppConfig } from "@shared/config/app.config";
import { initConfig, saveConfig } from "./config.async.actions";

export type ConfigState = {
	current: AppConfig;
};

const initialState: ConfigState = {
	current: defaultAppConfig,
};

const slice = createSlice({
	name: "config",
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder.addCase(initConfig.fulfilled, (state, action) => {
			state.current = action.payload;
		});
		builder.addCase(saveConfig.pending, (state, action) => {
			state.current = action.meta.arg;
		});
	},
});

export const configReducer = slice.reducer;
