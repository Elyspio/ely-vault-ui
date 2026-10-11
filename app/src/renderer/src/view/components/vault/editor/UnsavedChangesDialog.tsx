import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

type Props = {
	open: boolean;
	saving: boolean;
	onSave: () => void;
	onDiscard: () => void;
	onCancel: () => void;
};

/**
 * Asked when the user leaves an editor with unsaved changes (select, filter, close)
 */
export function UnsavedChangesDialog({ open, saving, onSave, onDiscard, onCancel }: Readonly<Props>) {
	return (
		<Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
			<DialogTitle>Unsaved changes</DialogTitle>
			<DialogContent>
				<DialogContentText>Save the changes to this item before leaving it?</DialogContentText>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button color="inherit" onClick={onCancel} disabled={saving}>
					Cancel
				</Button>
				<Button color="inherit" onClick={onDiscard} disabled={saving}>
					Discard
				</Button>
				<Button variant="contained" onClick={onSave} disabled={saving} autoFocus>
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
}
