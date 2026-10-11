import { type Dispatch, type SetStateAction, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { useVaultActions } from "@hooks/useVaultActions";
import type { ItemDraft, SshImportResult, SshKeyPreview, VaultItem } from "@shared/types/vault.types";
import { EditorSection } from "./EditorSection";
import { SshKeyAcquire } from "./SshKeyAcquire";
import { SshPassphraseDialog } from "./SshPassphraseDialog";
import { FieldRow } from "../fields/FieldRow";

type Props = {
	/** Edited item, null in create mode */
	item: VaultItem | null;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
};

/** Passphrase asked for an encrypted key: the token is the key held by the main process, `error` the last answer */
type PassphraseRequest = { token: string; error: string | null };

/**
 * SSH key of an SSH key item. The private key never reaches the renderer: a generated or imported key is only
 * known here by its token, which the draft carries until the item is saved.
 *
 * Create: a key is generated, imported or pasted. Edit: the current key is shown and can be replaced.
 */
export function SshKeySection({ item, setDraft }: Readonly<Props>) {
	const actions = useVaultActions();
	const [preview, setPreview] = useState<SshKeyPreview | null>(null);
	const [replacing, setReplacing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [passphrase, setPassphrase] = useState<PassphraseRequest | null>(null);

	// Creating always needs a key: the acquisition actions are the only content until one is ready
	const acquiring = item === null || replacing;

	/** A key is ready: the draft carries its token */
	const accept = (key: SshKeyPreview) => {
		setPreview(key);
		setReplacing(false);
		setError(null);
		setPassphrase(null);
		setDraft((current) => ({ ...current, sshKey: { token: key.token } }));
	};

	/** Back to the key the item already has (edit) or to the choice of a key (create) */
	const discard = () => {
		setPreview(null);
		setError(null);
		setDraft((current) => ({ ...current, sshKey: undefined }));
	};

	const handle = (result: SshImportResult) => {
		if (result.status === "success") accept(result.key);
		else if (result.status === "passphrase-required") setPassphrase({ token: result.token, error: null });
		else if (result.status === "error") setError(result.message);
	};

	const generate = async () => {
		setBusy(true);
		setError(null);
		try {
			accept(await webContainer.get(VaultService).generateSshKey());
		} catch (failure) {
			setError(ipcErrorMessage(failure));
		} finally {
			setBusy(false);
		}
	};

	/** File and pasted text: `cancelled` (dialog closed) changes nothing */
	const importFrom = async (source: { kind: "file" } | { kind: "text"; text: string }) => {
		setBusy(true);
		setError(null);
		try {
			handle(await webContainer.get(VaultService).importSshKey(source, null));
		} catch (failure) {
			setError(ipcErrorMessage(failure));
		} finally {
			setBusy(false);
		}
	};

	/** Passphrase of an encrypted key: a wrong one keeps the dialog open with the error */
	const submitPassphrase = async (secret: string) => {
		if (!passphrase) return;
		const { token } = passphrase;
		setBusy(true);
		try {
			const result = await webContainer.get(VaultService).importSshKey({ kind: "pending", token }, secret);
			if (result.status === "success") accept(result.key);
			else if (result.status === "error") setPassphrase({ token, error: result.message });
			else if (result.status === "passphrase-required") setPassphrase({ token, error: "Enter the passphrase" });
		} catch (failure) {
			setPassphrase({ token, error: ipcErrorMessage(failure) });
		} finally {
			setBusy(false);
		}
	};

	const cancelReplacement = () => {
		setReplacing(false);
		setError(null);
	};

	const copy = (value: string, label: string) => () => void actions.copy(null, { kind: "text", value }, label);

	return (
		<EditorSection title="SSH key">
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				{error && <Alert severity="error">{error}</Alert>}

				{preview && (
					<>
						<FieldRow label="Key type" mono>
							{preview.keyType}
						</FieldRow>
						<FieldRow label="Public key" mono multiline onCopy={copy(preview.publicKey, "Public key")}>
							{preview.publicKey}
						</FieldRow>
						<FieldRow label="Fingerprint" mono onCopy={copy(preview.keyFingerprint, "Fingerprint")}>
							{preview.keyFingerprint}
						</FieldRow>
						<Box>
							<Button size="small" color="inherit" onClick={discard}>
								{item ? "Keep the current key" : "Discard this key"}
							</Button>
						</Box>
					</>
				)}

				{!preview && item && !replacing && (
					<>
						<FieldRow label="Public key" mono multiline onCopy={item.sshKey?.publicKey ? copy(item.sshKey.publicKey, "Public key") : undefined}>
							{item.sshKey?.publicKey ?? "No public key"}
						</FieldRow>
						<FieldRow label="Fingerprint" mono onCopy={item.sshKey?.keyFingerprint ? copy(item.sshKey.keyFingerprint, "Fingerprint") : undefined}>
							{item.sshKey?.keyFingerprint ?? "No fingerprint"}
						</FieldRow>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
							<Button size="small" variant="outlined" color="inherit" onClick={() => setReplacing(true)}>
								Replace key
							</Button>
							<Typography sx={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>
								{item.sshKey?.hasPrivateKey ? "Private key stored, not shown." : "No private key."}
							</Typography>
						</Box>
					</>
				)}

				{!preview && acquiring && (
					<SshKeyAcquire
						busy={busy}
						// Create mode: the name keeps the focus; "Replace key" (edit) moves it to the actions
						autoFocus={item !== null}
						onGenerate={() => void generate()}
						onImportFile={() => void importFrom({ kind: "file" })}
						onConvert={(text) => void importFrom({ kind: "text", text })}
					/>
				)}

				{!preview && item && replacing && (
					<Box>
						<Button size="small" color="inherit" onClick={cancelReplacement}>
							Cancel replacement
						</Button>
					</Box>
				)}
			</Box>

			{passphrase && <SshPassphraseDialog error={passphrase.error} busy={busy} onSubmit={(secret) => void submitPassphrase(secret)} onCancel={() => setPassphrase(null)} />}
		</EditorSection>
	);
}
