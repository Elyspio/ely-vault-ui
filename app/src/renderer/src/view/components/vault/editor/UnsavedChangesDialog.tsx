import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation(["editor", "common"]);
	return (
		<Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
			<DialogTitle>{t("unsaved.title")}</DialogTitle>
			<DialogContent>
				<DialogContentText>{t("unsaved.question")}</DialogContentText>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button color="inherit" onClick={onCancel} disabled={saving}>
					{t("common:cancel")}
				</Button>
				<Button color="inherit" onClick={onDiscard} disabled={saving}>
					{t("unsaved.discard")}
				</Button>
				<Button variant="contained" onClick={onSave} disabled={saving} autoFocus>
					{t("common:save")}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
