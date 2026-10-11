import { useRef } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useDialogFocus } from "@hooks/useDialogFocus";

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
	const cancelRef = useRef<HTMLButtonElement>(null);
	const focus = useDialogFocus(() => cancelRef.current);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ transition: focus }}>
			<DialogTitle>{title}</DialogTitle>
			<DialogContent>
				<DialogContentText>{message}</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button ref={cancelRef} onClick={onClose}>
					Cancel
				</Button>
				<Button color="error" variant="contained" onClick={onConfirm}>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
