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
	{ value: TwoFactorMethod.Authenticator, label: "Application d'authentification" },
	{ value: TwoFactorMethod.Email, label: "Code reçu par e-mail" },
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
			<AuthLayout title="Certificat non reconnu" subtitle="Ce poste ne fait pas confiance au certificat présenté par le serveur">
				<CertificateReview certificate={untrustedCertificate} request={{ serverUrl, email, password }} />
			</AuthLayout>
		);
	}

	if (ssoRequired) {
		return (
			<AuthLayout title="Connexion SSO" subtitle={`Ce serveur impose l'authentification de votre organisation pour ${email}`}>
				<Stack spacing={2}>
					<Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
						La page de connexion de votre organisation va s'ouvrir dans le navigateur. Une fois authentifié, revenez ici : le mot de passe maître saisi déchiffrera
						le coffre sur ce poste.
					</Typography>

					{error && (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					)}

					<Button
						variant="contained"
						size="large"
						disabled={pending}
						onClick={submit}
						startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
					>
						{pending ? "Terminez la connexion dans le navigateur…" : "Continuer avec le SSO"}
					</Button>

					<Box sx={{ textAlign: "center" }}>
						<Link
							component="button"
							type="button"
							variant="body2"
							underline="hover"
							onClick={() => void dispatch(pending ? cancelLogin() : resetSso())}
						>
							{pending ? "Annuler" : "Revenir à la connexion"}
						</Link>
					</Box>
				</Stack>
			</AuthLayout>
		);
	}

	const canSubmit = twoFactorRequired ? code.trim().length > 0 : /^https:\/\/.+/.test(serverUrl) && email.includes("@") && password.length > 0;

	return (
		<AuthLayout
			title={twoFactorRequired ? "Vérification en deux étapes" : "Connexion"}
			subtitle={twoFactorRequired ? `Saisissez le code de vérification pour ${email}` : "Connectez-vous à votre serveur Vaultwarden ou Bitwarden"}
			footer={
				<Typography variant="caption" sx={{ color: "var(--text-faint)" }}>
					Le mot de passe maître ne quitte jamais cet ordinateur : le coffre est déchiffré localement.
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
							<TextField select label="Méthode" size="small" value={method} onChange={(event) => setMethod(Number(event.target.value) as TwoFactorMethod)}>
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
								label="Serveur"
								placeholder="https://vault.exemple.fr"
								value={serverUrl}
								onChange={(event) => setServerUrl(event.target.value)}
								autoFocus={!previousServer}
							/>
							<TextField label="Adresse e-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus={!!previousServer} />
							<PasswordField label="Mot de passe maître" value={password} onChange={(event) => setPassword(event.target.value)} />
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
						{pending ? "Connexion et déchiffrement…" : twoFactorRequired ? "Vérifier" : "Se connecter"}
					</Button>

					{twoFactorRequired && method === TwoFactorMethod.Email && (
						<Button
							variant="text"
							size="small"
							disabled={pending}
							onClick={() => void dispatch(login({ serverUrl, email, password, twoFactor: { method, code: "" } }))}
						>
							Envoyer le code par e-mail
						</Button>
					)}

					{twoFactorRequired && (
						<Box sx={{ textAlign: "center" }}>
							<Link component="button" type="button" variant="body2" underline="hover" onClick={() => dispatch(resetTwoFactor())}>
								Revenir à la connexion
							</Link>
						</Box>
					)}
				</Stack>
			</form>
		</AuthLayout>
	);
}
