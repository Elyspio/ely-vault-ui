import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { alpha, Alert, Avatar, Button, CircularProgress, Link, Stack, Tooltip, Typography } from "@mui/material";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import CloudOffRounded from "@mui/icons-material/CloudOffRounded";
import { offlineAccessMs } from "@shared/config/app.config";
import { useAppDispatch, useAppSelector } from "@store";
import { helloUnlock, logout, unlock } from "@modules/session/session.async.actions";
import { webContainer } from "@core/di/web.container";
import { SessionService } from "@services/session.service";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "@components/shared/PasswordField";

/** Windows Hello opens by itself only on the first unlock screen after startup, not after a lock */
let startupHello = true;

/** Called once the vault is open: the unlock screens after a lock wait for the user */
export function endStartupHello() {
	startupHello = false;
}

export function UnlockScreen() {
	const dispatch = useAppDispatch();
	const { t } = useTranslation("auth");
	const { pending, error } = useAppSelector((state) => state.session);
	const account = useAppSelector((state) => state.session.current);
	const offlineAccessMinutes = useAppSelector((state) => offlineAccessMs(state.config.current.security.offlineAccessMinutes) / 60_000);
	const [password, setPassword] = useState("");
	const [helloEnabled, setHelloEnabled] = useState(false);
	const { t: settings } = useTranslation("settings");
	const durationText = (minutes: number) => (minutes % 60 === 0 ? settings("durations.hours", { count: minutes / 60 }) : settings("durations.minutes", { count: minutes }));

	// At startup, Windows Hello opens right away when the window has the focus
	useEffect(() => {
		let active = true;
		void webContainer
			.get(SessionService)
			.helloStatus()
			.then(({ enabled }) => {
				if (!active) return;
				setHelloEnabled(enabled);
				if (enabled && startupHello && document.hasFocus()) void dispatch(helloUnlock());
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [dispatch]);

	const host = account?.serverUrl ? new URL(account.serverUrl).host : "";
	const authRejected = account?.accessBlock === "authentication-required";
	const accessHint = authRejected ? "unlock.access.authenticationRequired" : "unlock.access.offlineExpired";
	// One sentence per line: the tooltip stays readable
	const accessDetails = authRejected
		? [t("unlock.access.authenticationRequired.details.reason"), t("unlock.access.authenticationRequired.details.fix")]
		: [
				t("unlock.access.offlineExpired.details.window", { duration: durationText(offlineAccessMinutes) }),
				t("unlock.access.offlineExpired.details.fix"),
				t("unlock.access.offlineExpired.details.setting"),
			];

	return (
		<AuthLayout
			title={t("unlock.title")}
			subtitle={
				<>
					{account?.email}
					<br />
					<span style={{ color: "var(--text-faint)" }}>{host}</span>
				</>
			}
			avatar={
				<Avatar
					sx={{
						width: 56,
						height: 56,
						mb: 2,
						bgcolor: "var(--accent-soft)",
						color: "primary.main",
						fontWeight: 600,
						fontSize: "1.4rem",
						border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
					}}
				>
					{account?.email?.[0]?.toUpperCase() ?? "?"}
				</Avatar>
			}
			footer={
				<Link component="button" variant="body2" underline="hover" sx={{ color: "var(--text-muted)" }} onClick={() => dispatch(logout())}>
					{t("unlock.logout")}
				</Link>
			}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (password && !pending) void dispatch(unlock(password)).then(() => setPassword(""));
				}}
			>
				<Stack spacing={2}>
					{account?.accessBlock && (
						<Tooltip
							title={
								<Stack spacing={0.5} sx={{ py: 0.5 }}>
									{accessDetails.map((line) => (
										<span key={line}>{line}</span>
									))}
								</Stack>
							}
						>
							<Typography
								variant="body2"
								tabIndex={0}
								sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: "warning.main", cursor: "help" }}
							>
								<CloudOffRounded fontSize="small" />
								{t(`${accessHint}.label`)}
							</Typography>
						</Tooltip>
					)}
					<PasswordField autoFocus label={t("unlock.masterPasswordLabel")} value={password} onChange={(event) => setPassword(event.target.value)} />
					{error && (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					)}
					<Button
						type="submit"
						variant="contained"
						size="large"
						disabled={!password || pending}
						startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <LockOpenRounded />}
					>
						{pending ? t("unlock.pending") : t("unlock.submit")}
					</Button>
					{helloEnabled && (
						<Button variant="outlined" size="large" disabled={pending} startIcon={<FingerprintRounded />} onClick={() => void dispatch(helloUnlock())}>
							{t("unlock.withHello")}
						</Button>
					)}
				</Stack>
			</form>
		</AuthLayout>
	);
}
