import { Button, Paper, Snackbar, Typography } from "@mui/material";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import InfoRounded from "@mui/icons-material/InfoRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { hideToast, type Toast } from "@modules/ui/ui.reducer";
import { useVaultWrites } from "@hooks/useVaultWrites";
import { selectItem } from "@modules/vault/vault.reducer";

const icons = {
	success: <CheckCircleRounded sx={{ fontSize: 18, color: "success.main" }} />,
	error: <ErrorRounded sx={{ fontSize: 18, color: "error.main" }} />,
	info: <InfoRounded sx={{ fontSize: 18, color: "primary.main" }} />,
};

/** Toasts with an action stay longer, so that the user has time to click it */
const actionDuration = 6000;

export function Toaster() {
	const toast = useAppSelector((state) => state.ui.toast);
	const dispatch = useAppDispatch();
	const writes = useVaultWrites();

	/** Runs the action of the toast, then hides it (the write may show its own toast) */
	const runAction = (current: Toast) => {
		dispatch(hideToast(current.id));
		if (current.action?.kind === "restore-item") {
			const { itemId } = current.action;
			// Undo puts the item back where the user left it: selected
			void writes.restoreItem(itemId).then((outcome) => outcome?.status === "success" && dispatch(selectItem(itemId)));
		}
	};

	return (
		<Snackbar
			key={toast?.id}
			open={!!toast}
			autoHideDuration={toast?.action ? actionDuration : toast?.severity === "error" ? 5000 : 2500}
			onClose={(_, reason) => reason !== "clickaway" && toast && dispatch(hideToast(toast.id))}
			anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
		>
			<Paper
				elevation={8}
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1,
					px: 1.75,
					py: 1,
					borderRadius: 2,
					bgcolor: "var(--surface-3)",
					border: "1px solid var(--border-medium)",
				}}
			>
				{toast && icons[toast.severity]}
				<Typography variant="body2" sx={{ fontWeight: 500 }}>
					{toast?.message}
				</Typography>
				{toast?.action && (
					<Button size="small" color="primary" onClick={() => runAction(toast)} sx={{ ml: 0.5, fontWeight: 600 }}>
						{toast.action.label}
					</Button>
				)}
			</Paper>
		</Snackbar>
	);
}
