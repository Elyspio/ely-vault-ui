import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { alpha, Alert, Avatar, Button, CircularProgress, Link, Stack } from "@mui/material";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { helloUnlock, logout, unlock } from "@modules/session/session.async.actions";
import { webContainer } from "@core/di/web.container";
import { SessionService } from "@services/session.service";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "@components/shared/PasswordField";

export function UnlockScreen() {
	const dispatch = useAppDispatch();
	const { t } = useTranslation("auth");
	const { pending, error } = useAppSelector((state) => state.session);
	const account = useAppSelector((state) => state.session.current);
	const [password, setPassword] = useState("");
	const [helloEnabled, setHelloEnabled] = useState(false);

	// Windows Hello opens right away when the window has the focus (not after an auto-lock while away)
	useEffect(() => {
		let active = true;
		void webContainer
			.get(SessionService)
			.helloStatus()
			.then(({ enabled }) => {
				if (!active) return;
				setHelloEnabled(enabled);
				if (enabled && document.hasFocus()) void dispatch(helloUnlock());
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [dispatch]);

	const host = account?.serverUrl ? new URL(account.serverUrl).host : "";

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
