import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, CircularProgress, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "@store";
import { cancelLogin, login } from "@modules/session/session.async.actions";
import { resetSso, resetTwoFactor } from "@modules/session/session.reducer";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "@components/shared/PasswordField";
import { CertificateReview } from "./CertificateReview";
import { TwoFactorMethod } from "@shared/types/vault.types";

/** Labels are keys of auth:twoFactor.methods, translated at render */
const twoFactorMethods = [
	{ value: TwoFactorMethod.Authenticator, label: "authenticator" },
	{ value: TwoFactorMethod.Email, label: "email" },
	{ value: TwoFactorMethod.Yubikey, label: "yubikey" },
] as const;

export function LoginScreen() {
	const dispatch = useAppDispatch();
	const { t } = useTranslation(["auth", "common"]);
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
			<AuthLayout title={t("certificate.title")} subtitle={t("certificate.subtitle")}>
				<CertificateReview certificate={untrustedCertificate} request={{ serverUrl, email, password }} />
			</AuthLayout>
		);
	}

	if (ssoRequired) {
		return (
			<AuthLayout title={t("sso.title")} subtitle={t("sso.subtitle", { email })}>
				<Stack spacing={2}>
					<Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
						{t("sso.description")}
					</Typography>

					{error && (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					)}

					<Button variant="contained" size="large" disabled={pending} onClick={submit} startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}>
						{pending ? t("sso.pending") : t("sso.continue")}
					</Button>

					<Box sx={{ textAlign: "center" }}>
						<Link component="button" type="button" variant="body2" underline="hover" onClick={() => void dispatch(pending ? cancelLogin() : resetSso())}>
							{pending ? t("common:cancel") : t("login.backToLogin")}
						</Link>
					</Box>
				</Stack>
			</AuthLayout>
		);
	}

	const canSubmit = twoFactorRequired ? code.trim().length > 0 : /^https:\/\/.+/.test(serverUrl) && email.includes("@") && password.length > 0;

	return (
		<AuthLayout
			title={twoFactorRequired ? t("twoFactor.title") : t("login.title")}
			subtitle={twoFactorRequired ? t("twoFactor.subtitle", { email }) : t("login.subtitle")}
			footer={
				<Typography variant="caption" sx={{ color: "var(--text-faint)" }}>
					{t("login.footer")}
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
							<TextField
								select
								label={t("twoFactor.methodLabel")}
								size="small"
								value={method}
								onChange={(event) => setMethod(Number(event.target.value) as TwoFactorMethod)}
							>
								{twoFactorMethods.map((m) => (
									<MenuItem key={m.value} value={m.value}>
										{t(`twoFactor.methods.${m.label}`)}
									</MenuItem>
								))}
							</TextField>
							<TextField
								autoFocus
								label={t("twoFactor.codeLabel")}
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
								label={t("login.serverLabel")}
								placeholder="https://vault.example.com"
								value={serverUrl}
								onChange={(event) => setServerUrl(event.target.value)}
								autoFocus={!previousServer}
							/>
							<TextField label={t("login.emailLabel")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus={!!previousServer} />
							<PasswordField label={t("login.masterPasswordLabel")} value={password} onChange={(event) => setPassword(event.target.value)} />
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
						{pending ? t("login.pending") : twoFactorRequired ? t("twoFactor.verify") : t("login.submit")}
					</Button>

					{twoFactorRequired && method === TwoFactorMethod.Email && (
						<Button
							variant="text"
							size="small"
							disabled={pending}
							onClick={() => void dispatch(login({ serverUrl, email, password, twoFactor: { method, code: "" } }))}
						>
							{t("twoFactor.sendEmail")}
						</Button>
					)}

					{twoFactorRequired && (
						<Box sx={{ textAlign: "center" }}>
							<Link component="button" type="button" variant="body2" underline="hover" onClick={() => dispatch(resetTwoFactor())}>
								{t("login.backToLogin")}
							</Link>
						</Box>
					)}
				</Stack>
			</form>
		</AuthLayout>
	);
}
