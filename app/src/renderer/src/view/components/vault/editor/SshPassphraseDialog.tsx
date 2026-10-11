import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@mui/material";

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
				<DialogTitle>Key passphrase</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 1 }}>
						This SSH key is encrypted. Its passphrase is used once to convert it: the vault stores the key unencrypted, like the official clients.
					</DialogContentText>
					<TextField
						autoFocus
						fullWidth
						size="small"
						type="password"
						label="Passphrase"
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
						Cancel
					</Button>
					<Button type="submit" variant="contained" disabled={busy || passphrase === ""}>
						Convert
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
}
