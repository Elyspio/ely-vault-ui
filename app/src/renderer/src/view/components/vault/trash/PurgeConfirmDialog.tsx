import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

type Props = {
	open: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	onClose: () => void;
};

/**
 * Confirmation of a permanent deletion. Cancel has the focus: Enter alone never destroys anything.
 */
export function PurgeConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: Readonly<Props>) {
	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{title}</DialogTitle>
			<DialogContent>
				<DialogContentText>{message}</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button autoFocus onClick={onClose}>
					Cancel
				</Button>
				<Button color="error" variant="contained" onClick={onConfirm}>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
