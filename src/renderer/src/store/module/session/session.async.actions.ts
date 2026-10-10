import { createAsyncActionGenerator, getServices } from "@store/utils/utils.actions";
import { SessionService } from "@services/session.service";
import { CertificateService } from "@services/certificate.service";
import { createAction } from "@reduxjs/toolkit";
import type { LoginRequest, SessionState } from "@shared/types/vault.types";
import { loadVault } from "@modules/vault/vault.async.actions";
import { initConfig } from "@modules/config/config.async.actions";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage } from "@core/utils/ipc.utils";

const createAsyncThunk = createAsyncActionGenerator("session");

export const sessionStateChanged = createAction<SessionState>("session/state-changed");

export const refreshSession = createAsyncThunk("refresh", async (_, { extra }) => {
	const services = getServices({ session: SessionService }, extra);
	return await services.session.state();
});

export const login = createAsyncThunk("login", async (request: LoginRequest, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ session: SessionService }, extra);
	const result = await services.session.login(request);

	if (result.status === "error") return rejectWithValue(result.message);
	if (result.status === "success") {
		await dispatch(refreshSession());
		await dispatch(loadVault());
	}
	return result;
});

/**
 * Stops a login waiting for the browser (SSO): the pending login then fails with a cancellation message
 */
export const cancelLogin = createAsyncThunk("cancel-login", async (_, { extra }) => {
	const services = getServices({ session: SessionService }, extra);
	await services.session.cancelLogin();
});

/**
 * Approves the certificate authority the user reviewed, then retries the login
 */
export const trustCertificate = createAsyncThunk("trust-certificate", async (arg: { fingerprint256: string; request: LoginRequest }, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ certificate: CertificateService }, extra);
	try {
		await services.certificate.trust(arg.fingerprint256);
	} catch (error) {
		return rejectWithValue(ipcErrorMessage(error));
	}
	await dispatch(login(arg.request));
	return true;
});

/**
 * Imports an authority certificate from a file, then retries the login
 */
export const importAuthority = createAsyncThunk("import-authority", async (request: LoginRequest, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ certificate: CertificateService }, extra);
	try {
		const imported = await services.certificate.import();
		if (imported.length === 0) return false;
		dispatch(showToast(`Autorité « ${imported.map((c) => c.subject).join(", ")} » importée`));
	} catch (error) {
		return rejectWithValue(ipcErrorMessage(error));
	}
	await dispatch(login(request));
	return true;
});

export const unlock = createAsyncThunk("unlock", async (password: string, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ session: SessionService }, extra);
	const result = await services.session.unlock(password);

	if (result.status === "error") return rejectWithValue(result.message);
	await dispatch(refreshSession());
	await dispatch(loadVault());
	return result.status;
});

export const lock = createAsyncThunk("lock", async (_, { extra, dispatch }) => {
	const services = getServices({ session: SessionService }, extra);
	await services.session.lock();
	await dispatch(refreshSession());
});

export const logout = createAsyncThunk("logout", async (_, { extra, dispatch }) => {
	const services = getServices({ session: SessionService }, extra);
	try {
		await services.session.logout();
	} catch (error) {
		dispatch(showToast(ipcErrorMessage(error), "error"));
	}
	await dispatch(refreshSession());
});

export const initApp = createAsyncThunk("init-app", async (_, { dispatch }) => {
	window.preload.ipc.on.session.state((state) => dispatch(sessionStateChanged(state)));
	window.preload.ipc.on.clipboard.cleared(() => dispatch(showToast("Presse-papiers effacé", "info")));

	await dispatch(initConfig());
	const state = await dispatch(refreshSession()).unwrap();
	if (state.status === "unlocked") await dispatch(loadVault());
});
