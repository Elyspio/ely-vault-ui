import { useState } from "react";
import { Alert, Avatar, Button, CircularProgress, Link, Stack } from "@mui/material";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { logout, unlock } from "@modules/session/session.async.actions";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "@components/shared/PasswordField";

export function UnlockScreen() {
	const dispatch = useAppDispatch();
	const { pending, error } = useAppSelector((state) => state.session);
	const account = useAppSelector((state) => state.session.current);
	const [password, setPassword] = useState("");

	const host = account?.serverUrl ? new URL(account.serverUrl).host : "";

	return (
		<AuthLayout
			title="Coffre verrouillé"
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
						border: "1px solid rgba(79,210,255,0.25)",
					}}
				>
					{account?.email?.[0]?.toUpperCase() ?? "?"}
				</Avatar>
			}
			footer={
				<Link component="button" variant="body2" underline="hover" sx={{ color: "var(--text-muted)" }} onClick={() => dispatch(logout())}>
					Se déconnecter ou changer de compte
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
					<PasswordField autoFocus label="Mot de passe maître" value={password} onChange={(event) => setPassword(event.target.value)} />
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
						{pending ? "Déchiffrement…" : "Déverrouiller"}
					</Button>
				</Stack>
			</form>
		</AuthLayout>
	);
}
