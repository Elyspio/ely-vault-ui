import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Switch, TextField, Typography } from "@mui/material";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import { webContainer } from "@core/di/web.container";
import { SessionService } from "@services/session.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { useDialogFocus } from "@hooks/useDialogFocus";
import type { HelloUnlockStatus } from "@shared/types/vault.types";

/**
 * Switch of the Windows Hello unlock, shown only when Windows Hello is set up on this computer.
 * Enabling it asks the master password, which the main process checks and stores encrypted.
 */
export function HelloUnlockSetting({ render }: Readonly<{ render: (control: ReactNode) => ReactNode }>) {
	const [status, setStatus] = useState<HelloUnlockStatus | null>(null);
	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const passwordRef = useRef<HTMLInputElement>(null);
	const focus = useDialogFocus(() => passwordRef.current);
	const service = webContainer.get(SessionService);

	useEffect(() => {
		let active = true;
		void service
			.helloStatus()
			.then((value) => active && setStatus(value))
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [service]);

	if (!status?.available) return null;

	const close = () => {
		setOpen(false);
		setPassword("");
		setError(null);
	};

	const submit = async () => {
		setPending(true);
		try {
			const result = await service.enableHello(password);
			if (result.status === "success") {
				setStatus({ ...status, enabled: true });
				close();
			} else if (result.status === "error") setError(result.message);
		} catch (err) {
			setError(ipcErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	const toggle = async (checked: boolean) => {
		if (checked) {
			setOpen(true);
			return;
		}
		await service.disableHello();
		setStatus({ ...status, enabled: false });
	};

	return (
		<>
			{render(<Switch checked={status.enabled} onChange={(_, checked) => void toggle(checked)} />)}
			<Dialog open={open} onClose={close} maxWidth="xs" fullWidth slotProps={{ transition: focus }}>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (password && !pending) void submit();
					}}
				>
					<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<FingerprintRounded fontSize="small" color="primary" />
						Windows Hello
					</DialogTitle>
					<DialogContent>
						<Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
							Enter your master password, then confirm with Windows Hello. The password is stored encrypted for your Windows account.
						</Typography>
						<TextField
							inputRef={passwordRef}
							fullWidth
							size="small"
							type="password"
							label="Master password"
							value={password}
							error={error !== null}
							onChange={(event) => {
								setPassword(event.target.value);
								setError(null);
							}}
						/>
						{error && (
							<Alert severity="error" variant="outlined" sx={{ mt: 2, py: 0 }}>
								{error}
							</Alert>
						)}
					</DialogContent>
					<DialogActions>
						<Button onClick={close}>Cancel</Button>
						<Button type="submit" variant="contained" disabled={!password || pending}>
							Enable
						</Button>
					</DialogActions>
				</form>
			</Dialog>
		</>
	);
}
