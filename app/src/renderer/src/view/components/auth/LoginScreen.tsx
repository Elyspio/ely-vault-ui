import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "@store";
import { cancelLogin, login } from "@modules/session/session.async.actions";
import { resetSso, resetTwoFactor } from "@modules/session/session.reducer";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "@components/shared/PasswordField";
import { CertificateReview } from "./CertificateReview";
import { TwoFactorMethod } from "@shared/types/vault.types";

const twoFactorMethods = [
	{ value: TwoFactorMethod.Authenticator, label: "Authenticator app" },
	{ value: TwoFactorMethod.Email, label: "Code sent by email" },
	{ value: TwoFactorMethod.Yubikey, label: "YubiKey (OTP)" },
];

export function LoginScreen() {
	const dispatch = useAppDispatch();
	const { pending, error, twoFactorRequired, ssoRequired, untrustedCertificate } = useAppSelector((state) => state.session);
	const previousServer = useAppSelector((state) => state.session.current?.serverUrl);

	const [serverUrl, setServerUrl] = useState(previousServer ?? "https://");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [method, setMethod] = useState(TwoFactorMethod.Authenticator);
	const [code, setCode] = useState("");

	const submit = () => {
		void dispatch(
			login({
				serverUrl,
				email,
				password,
				twoFactor: twoFactorRequired ? { method, code: code.replaceAll(/\s/g, "") } : undefined,
				sso: ssoRequired || undefined,
			})
		);
	};

	if (untrustedCertificate) {
		return (
			<AuthLayout title="Certificate not recognized" subtitle="This computer does not trust the certificate presented by the server">
				<CertificateReview certificate={untrustedCertificate} request={{ serverUrl, email, password }} />
			</AuthLayout>
		);
	}

	if (ssoRequired) {
		return (
			<AuthLayout title="SSO login" subtitle={`This server requires your organization's authentication for ${email}`}>
				<Stack spacing={2}>
					<Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
						Your organization's login page opens in the browser. Once authenticated, come back here: the master password you entered decrypts the vault on this
						computer.
					</Typography>

					{error && (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					)}

					<Button variant="contained" size="large" disabled={pending} onClick={submit} startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}>
						{pending ? "Finish logging in in the browser…" : "Continue with SSO"}
					</Button>

					<Box sx={{ textAlign: "center" }}>
						<Link component="button" type="button" variant="body2" underline="hover" onClick={() => void dispatch(pending ? cancelLogin() : resetSso())}>
							{pending ? "Cancel" : "Back to login"}
						</Link>
					</Box>
				</Stack>
			</AuthLayout>
		);
	}

	const canSubmit = twoFactorRequired ? code.trim().length > 0 : /^https:\/\/.+/.test(serverUrl) && email.includes("@") && password.length > 0;

	return (
		<AuthLayout
			title={twoFactorRequired ? "Two-step verification" : "Log in"}
			subtitle={twoFactorRequired ? `Enter the verification code for ${email}` : "Log in to your Vaultwarden or Bitwarden server"}
			footer={
				<Typography variant="caption" sx={{ color: "var(--text-faint)" }}>
					The master password never leaves this computer: the vault is decrypted locally.
				</Typography>
			}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (canSubmit && !pending) submit();
				}}
			>
				<Stack spacing={2}>
					{twoFactorRequired ? (
						<>
							<TextField select label="Method" size="small" value={method} onChange={(event) => setMethod(Number(event.target.value) as TwoFactorMethod)}>
								{twoFactorMethods.map((m) => (
									<MenuItem key={m.value} value={m.value}>
										{m.label}
									</MenuItem>
								))}
							</TextField>
							<TextField
								autoFocus
								label="Code"
								value={code}
								onChange={(event) => setCode(event.target.value)}
								slotProps={{
									htmlInput: { className: "mono", inputMode: "numeric", autoComplete: "one-time-code", style: { letterSpacing: "0.3em", fontSize: "1.1rem" } },
								}}
							/>
						</>
					) : (
						<>
							<TextField
								label="Server"
								placeholder="https://vault.example.com"
								value={serverUrl}
								onChange={(event) => setServerUrl(event.target.value)}
								autoFocus={!previousServer}
							/>
							<TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus={!!previousServer} />
							<PasswordField label="Master password" value={password} onChange={(event) => setPassword(event.target.value)} />
						</>
					)}

					{error && (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					)}

					<Button
						type="submit"
						variant="contained"
						size="large"
						disabled={!canSubmit || pending}
						startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
					>
						{pending ? "Logging in and decrypting…" : twoFactorRequired ? "Verify" : "Log in"}
					</Button>

					{twoFactorRequired && method === TwoFactorMethod.Email && (
						<Button
							variant="text"
							size="small"
							disabled={pending}
							onClick={() => void dispatch(login({ serverUrl, email, password, twoFactor: { method, code: "" } }))}
						>
							Send the code by email
						</Button>
					)}

					{twoFactorRequired && (
						<Box sx={{ textAlign: "center" }}>
							<Link component="button" type="button" variant="body2" underline="hover" onClick={() => dispatch(resetTwoFactor())}>
								Back to login
							</Link>
						</Box>
					)}
				</Stack>
			</form>
		</AuthLayout>
	);
}
