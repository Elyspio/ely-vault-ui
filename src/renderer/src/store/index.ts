import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { Container } from "inversify";
import { webContainer } from "@core/di/web.container";
import { sessionReducer } from "@modules/session/session.reducer";
import { vaultReducer } from "@modules/vault/vault.reducer";
import { uiReducer } from "@modules/ui/ui.reducer";
import { configReducer } from "@modules/config/config.reducer";

const reducers = combineReducers({
	session: sessionReducer,
	vault: vaultReducer,
	ui: uiReducer,
	config: configReducer,
});

export const store = configureStore({
	reducer: reducers,
	middleware: (defaults) =>
		defaults({
			thunk: {
				extraArgument: {
					container: webContainer,
				},
			},
		}),
	devTools: import.meta.env.DEV,
});

export type StoreState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<StoreState> = useSelector;

export type ExtraArgument = {
	container: Container;
};
