import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";

type Props = {
	/** Answer of the last attempt (wrong passphrase, expired key) */
	error: string | null;
	busy: boolean;
	onSubmit: (passphrase: string) => void;
	onCancel: () => void;
};

/**
 * Passphrase of an encrypted SSH key. Enter converts, Escape cancels; the keys stop here, so the editor
 * shortcuts (Escape closes the editor, Ctrl+S saves) do not run behind the dialog.
 */
export function SshPassphraseDialog({ error, busy, onSubmit, onCancel }: Readonly<Props>) {
	const { t } = useTranslation(["editor", "common"]);
	const [passphrase, setPassphrase] = useState("");

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (passphrase !== "" && !busy) onSubmit(passphrase);
	};

	// Keys stay in the dialog: Ctrl+S / Escape of the editor behind must not fire (MUI closes the dialog on Escape)
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape") event.stopPropagation();
	};

	return (
		<Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
			<form onSubmit={submit}>
				<DialogTitle>{t("passphrase.title")}</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 1 }}>{t("passphrase.description")}</DialogContentText>
					<TextField
						autoFocus
						fullWidth
						size="small"
						type="password"
						label={t("passphrase.label")}
						onKeyDown={onKeyDown}
						autoComplete="off"
						value={passphrase}
						error={Boolean(error)}
						helperText={error}
						onChange={(event) => setPassphrase(event.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button color="inherit" onClick={onCancel}>
						{t("common:cancel")}
					</Button>
					<Button type="submit" variant="contained" disabled={busy || passphrase === ""}>
						{t("ssh.convert")}
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
}
