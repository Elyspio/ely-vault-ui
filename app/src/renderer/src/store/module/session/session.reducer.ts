import { createSlice } from "@reduxjs/toolkit";
import type { SessionState } from "@shared/types/vault.types";
import type { CertificateInfo } from "@shared/types/certificate.types";
import { helloUnlock, importAuthority, initApp, lock, login, logout, refreshSession, sessionStateChanged, trustCertificate, unlock } from "./session.async.actions";

export type SessionSliceState = {
	current: SessionState | null;
	/** The application could not reach the Bitwarden CLI at startup */
	fatalError: string | null;
	pending: boolean;
	error: string | null;
	twoFactorRequired: boolean;
	/** The server only accepts single sign-on for this account */
	ssoRequired: boolean;
	/** Certificate refused by the system, to review before approving it */
	untrustedCertificate: CertificateInfo | null;
};

const initialState: SessionSliceState = {
	current: null,
	fatalError: null,
	pending: false,
	error: null,
	twoFactorRequired: false,
	ssoRequired: false,
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
		resetSso(state) {
			state.ssoRequired = false;
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
			state.fatalError = action.error.message ?? "Unknown error";
		});

		for (const thunk of [login, unlock, helloUnlock, trustCertificate, importAuthority]) {
			builder.addCase(thunk.pending, (state) => {
				state.pending = true;
				state.error = null;
			});
			builder.addCase(thunk.rejected, (state, action) => {
				state.pending = false;
				state.error = (action.payload as string | undefined) ?? action.error.message ?? "Unknown error";
				// The certificate is checked before the CLI login: a failed login is past the review, show its error on the login form
				if (thunk === login) state.untrustedCertificate = null;
			});
		}
		builder.addCase(login.fulfilled, (state, action) => {
			state.pending = false;
			state.twoFactorRequired = action.payload.status === "two-factor-required";
			state.ssoRequired = action.payload.status === "sso-required";
			state.untrustedCertificate = action.payload.status === "untrusted-certificate" ? action.payload.certificate : null;
		});
		for (const thunk of [trustCertificate, importAuthority]) {
			builder.addCase(thunk.fulfilled, (state) => {
				state.pending = false;
			});
		}
		for (const thunk of [unlock, helloUnlock]) {
			builder.addCase(thunk.fulfilled, (state) => {
				state.pending = false;
			});
		}
		builder.addCase(lock.pending, (state) => {
			state.error = null;
		});
		builder.addCase(logout.fulfilled, (state) => {
			state.twoFactorRequired = false;
			state.ssoRequired = false;
			state.error = null;
		});
	},
});

export const { resetTwoFactor, resetSso, dismissCertificate } = slice.actions;
export const sessionReducer = slice.reducer;
