import { createSlice } from "@reduxjs/toolkit";
import type { SessionState } from "@shared/types/vault.types";
import type { CertificateInfo } from "@shared/types/certificate.types";
import { importAuthority, initApp, lock, login, logout, refreshSession, sessionStateChanged, trustCertificate, unlock } from "./session.async.actions";

export type SessionSliceState = {
	current: SessionState | null;
	/** The application could not reach the Bitwarden CLI at startup */
	fatalError: string | null;
	pending: boolean;
	error: string | null;
	twoFactorRequired: boolean;
	/** Certificate refused by the system, to review before approving it */
	untrustedCertificate: CertificateInfo | null;
};

const initialState: SessionSliceState = {
	current: null,
	fatalError: null,
	pending: false,
	error: null,
	twoFactorRequired: false,
	untrustedCertificate: null,
};

const slice = createSlice({
	name: "session",
	initialState,
	reducers: {
		resetTwoFactor(state) {
			state.twoFactorRequired = false;
			state.error = null;
		},
		dismissCertificate(state) {
			state.untrustedCertificate = null;
			state.error = null;
		},
	},
	extraReducers: (builder) => {
		builder.addCase(refreshSession.fulfilled, (state, action) => {
			state.current = action.payload;
		});
		builder.addCase(sessionStateChanged, (state, action) => {
			state.current = action.payload;
		});
		builder.addCase(initApp.rejected, (state, action) => {
			state.fatalError = action.error.message ?? "Erreur inconnue";
		});

		for (const thunk of [login, unlock, trustCertificate, importAuthority]) {
			builder.addCase(thunk.pending, (state) => {
				state.pending = true;
				state.error = null;
			});
			builder.addCase(thunk.rejected, (state, action) => {
				state.pending = false;
				state.error = (action.payload as string | undefined) ?? action.error.message ?? "Erreur inconnue";
			});
		}
		builder.addCase(login.fulfilled, (state, action) => {
			state.pending = false;
			state.twoFactorRequired = action.payload.status === "two-factor-required";
			state.untrustedCertificate = action.payload.status === "untrusted-certificate" ? action.payload.certificate : null;
		});
		for (const thunk of [trustCertificate, importAuthority]) {
			builder.addCase(thunk.fulfilled, (state) => {
				state.pending = false;
			});
		}
		builder.addCase(unlock.fulfilled, (state) => {
			state.pending = false;
		});
		builder.addCase(lock.pending, (state) => {
			state.error = null;
		});
		builder.addCase(logout.fulfilled, (state) => {
			state.twoFactorRequired = false;
			state.error = null;
		});
	},
});

export const { resetTwoFactor, dismissCertificate } = slice.actions;
export const sessionReducer = slice.reducer;
