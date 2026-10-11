import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import LockPersonRounded from "@mui/icons-material/LockPersonRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage, isRepromptRequired } from "@core/utils/ipc.utils";
import { useDialogFocus } from "@hooks/useDialogFocus";
import type { CopyRef, SecretRef } from "@shared/types/vault.types";

type RequestReprompt = () => Promise<boolean>;

export const RepromptContext = createContext<RequestReprompt>(() => Promise.resolve(false));

/**
 * Asks the master password again for items flagged "reprompt"; the main process checks it and unlocks them for a few minutes
 */
export function RepromptProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState(false);
	const [pending, setPending] = useState(false);
	const resolver = useRef<((value: boolean) => void) | null>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const focus = useDialogFocus(() => passwordRef.current);

	const request = useCallback<RequestReprompt>(
		() =>
			new Promise((resolve) => {
				resolver.current?.(false);
				resolver.current = resolve;
				setPassword("");
				setError(false);
				setOpen(true);
			}),
		[]
	);

	const close = (value: boolean) => {
		setOpen(false);
		setPassword("");
		resolver.current?.(value);
		resolver.current = null;
	};

	const submit = async () => {
		setPending(true);
		const valid = await webContainer.get(VaultService).verifyReprompt(password);
		setPending(false);
		if (valid) close(true);
		else setError(true);
	};

	return (
		<RepromptContext value={request}>
			{children}
			<Dialog open={open} onClose={() => close(false)} maxWidth="xs" fullWidth slotProps={{ transition: focus }}>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<LockPersonRounded fontSize="small" color="primary" />
						Protected item
					</DialogTitle>
					<DialogContent>
						<Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
							Enter your master password to access this secret.
						</Typography>
						<TextField
							inputRef={passwordRef}
							fullWidth
							size="small"
							type="password"
							label="Master password"
							value={password}
							error={error}
							onChange={(event) => {
								setPassword(event.target.value);
								setError(false);
							}}
						/>
						{error && (
							<Alert severity="error" variant="outlined" sx={{ mt: 2, py: 0 }}>
								Incorrect password
							</Alert>
						)}
					</DialogContent>
					<DialogActions sx={{ px: 3, pb: 2 }}>
						<Button onClick={() => close(false)} color="inherit">
							Cancel
						</Button>
						<Button type="submit" variant="contained" disabled={!password || pending}>
							Confirm
						</Button>
					</DialogActions>
				</form>
			</Dialog>
		</RepromptContext>
	);
}

/**
 * Copy, reveal and TOTP actions, with the master password reprompt and the feedback toasts
 */
export function useVaultActions() {
	const requestReprompt = useContext(RepromptContext);
	const dispatch = useAppDispatch();
	const clearSeconds = useAppSelector((state) => state.config.current.security.clipboardClearSeconds);

	return useMemo(() => {
		const service = webContainer.get(VaultService);

		async function withReprompt<T>(action: () => Promise<T>): Promise<T | null> {
			try {
				return await action();
			} catch (error) {
				if (isRepromptRequired(error)) {
					if (await requestReprompt()) return await withReprompt(action);
					return null;
				}
				dispatch(showToast(ipcErrorMessage(error), "error"));
				return null;
			}
		}

		return {
			async copy(itemId: string | null, ref: CopyRef, label: string) {
				const done = await withReprompt(async () => {
					await service.copy(itemId, ref);
					return true;
				});
				if (done) dispatch(showToast(clearSeconds ? `${label} copied · cleared in ${clearSeconds} s` : `${label} copied`));
			},
			reveal(itemId: string, ref: SecretRef) {
				return withReprompt(() => service.secret(itemId, ref));
			},
			totp(itemId: string) {
				return withReprompt(() => service.totp(itemId));
			},
			/** Minimizes the window and types the login into the previous one; the reprompt is asked before */
			async autoType(itemId: string) {
				await withReprompt(() => service.autoType(itemId));
			},
			async open(url: string) {
				await withReprompt(() => service.openExternal(url));
			},
		};
	}, [dispatch, requestReprompt, clearSeconds]);
}
