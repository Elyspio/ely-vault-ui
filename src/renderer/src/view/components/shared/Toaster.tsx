import { Paper, Snackbar, Typography } from "@mui/material";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import InfoRounded from "@mui/icons-material/InfoRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { hideToast } from "@modules/ui/ui.reducer";

const icons = {
	success: <CheckCircleRounded sx={{ fontSize: 18, color: "success.main" }} />,
	error: <ErrorRounded sx={{ fontSize: 18, color: "error.main" }} />,
	info: <InfoRounded sx={{ fontSize: 18, color: "primary.main" }} />,
};

export function Toaster() {
	const toast = useAppSelector((state) => state.ui.toast);
	const dispatch = useAppDispatch();

	return (
		<Snackbar
			key={toast?.id}
			open={!!toast}
			autoHideDuration={toast?.severity === "error" ? 5000 : 2500}
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
			</Paper>
		</Snackbar>
	);
}
