import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import { useAppDispatch } from "@store";
import { webContainer } from "@core/di/web.container";
import { SessionService } from "@services/session.service";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage } from "@core/utils/ipc.utils";

/**
 * Offers Windows Hello right after the first master password unlock of an account; the main process still holds
 * that password, so accepting only asks for the Windows Hello verification
 */
export function HelloOfferDialog() {
	const dispatch = useAppDispatch();
	const { t } = useTranslation("auth");
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const service = webContainer.get(SessionService);

	useEffect(() => {
		let active = true;
		void service
			.helloOffer()
			.then((offer) => active && setOpen(offer))
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [service]);

	const decline = () => {
		setOpen(false);
		void service.declineHello().catch(() => undefined);
	};

	const accept = async () => {
		setPending(true);
		setError(null);
		try {
			const result = await service.enableHello(null);
			if (result.status === "success") {
				setOpen(false);
				dispatch(showToast(t("hello.enabled")));
			} else if (result.status === "error") setError(result.message);
		} catch (err) {
			setError(ipcErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onClose={decline} maxWidth="xs" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
				<FingerprintRounded fontSize="small" color="primary" />
				{t("hello.title")}
			</DialogTitle>
			<DialogContent>
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					{t("hello.description")}
				</Typography>
				{error && (
					<Alert severity="error" variant="outlined" sx={{ mt: 2, py: 0 }}>
						{error}
					</Alert>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={decline} disabled={pending}>
					{t("hello.decline")}
				</Button>
				<Button variant="contained" autoFocus startIcon={<FingerprintRounded />} disabled={pending} onClick={() => void accept()}>
					{t("hello.accept")}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
