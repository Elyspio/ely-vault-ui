import { useState } from "react";
import { Alert, Box, Button, Chip, Typography } from "@mui/material";
import FolderRounded from "@mui/icons-material/FolderRounded";
import RestoreFromTrashRounded from "@mui/icons-material/RestoreFromTrashRounded";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import { store, useAppDispatch, useAppSelector } from "@store";
import { selectItem } from "@modules/vault/vault.reducer";
import { selectVisibleItems } from "@modules/vault/vault.selectors";
import { neighbourId } from "@modules/vault/vault.search";
import { CipherType, FieldType, type VaultItem } from "@shared/types/vault.types";
import { useVaultWrites } from "@hooks/useVaultWrites";
import { formatDateTime } from "@view/utils/date.utils";
import { ItemIcon } from "../ItemIcon";
import { FieldCard, FieldRow } from "../fields/FieldRow";
import { IdentityFields } from "../IdentityFields";
import { PurgeConfirmDialog } from "./PurgeConfirmDialog";

/**
 * Read-only view of a deleted item. It renders only non-secret values: no copy, no auto-type, no open, no reveal.
 */
export function TrashItemDetail({ item }: Readonly<{ item: VaultItem }>) {
	const dispatch = useAppDispatch();
	const writes = useVaultWrites();
	const snapshot = useAppSelector((state) => state.vault.snapshot);
	const folder = snapshot?.folders.find((f) => f.id === item.folderId);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);

	/**
	 * Selection once the item leaves the trash: its neighbour in the list. Computed before the write, while the item is still listed.
	 */
	const neighbour = () => neighbourId(selectVisibleItems(store.getState()), item.id);

	const restore = async () => {
		const next = neighbour();
		setBusy(true);
		const outcome = await writes.restoreItem(item.id);
		setBusy(false);
		if (outcome?.status === "success") dispatch(selectItem(next));
	};

	const purge = async () => {
		const next = neighbour();
		setConfirming(false);
		setBusy(true);
		const outcome = await writes.purgeItems([item.id]);
		setBusy(false);
		if (outcome?.status === "success") dispatch(selectItem(next));
	};

	return (
		<Box sx={{ height: "100%", overflow: "auto", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ maxWidth: 720, mx: "auto", px: 4, py: 3.5, animation: "fadeIn 150ms ease" }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
					<ItemIcon item={item} size={52} />
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography variant="h5" noWrap>
							{item.name}
						</Typography>
						{folder && <Chip size="small" icon={<FolderRounded />} label={folder.name} variant="outlined" sx={{ mt: 0.75, borderColor: "var(--border-subtle)" }} />}
					</Box>
					<Button variant="contained" size="small" startIcon={<RestoreFromTrashRounded />} disabled={busy} onClick={() => void restore()}>
						Restore
					</Button>
					<Button variant="outlined" color="error" size="small" startIcon={<DeleteForeverRounded />} disabled={busy} onClick={() => setConfirming(true)}>
						Delete permanently
					</Button>
				</Box>

				<Alert severity="info" variant="outlined" sx={{ mb: 2.5, borderColor: "var(--border-subtle)" }}>
					Deleted on {formatDateTime(item.deletedDate ?? item.revisionDate)}. Items are permanently deleted by the server after 30 days.
				</Alert>

				{item.type === CipherType.Login && item.login && (
					<>
						{item.login.username && (
							<FieldCard>
								<FieldRow label="Username">{item.login.username}</FieldRow>
							</FieldCard>
						)}
						{item.login.uris.length > 0 && (
							<FieldCard title={item.login.uris.length > 1 ? "Websites" : "Website"}>
								{item.login.uris.map((uri, index) => (
									<FieldRow key={index} label={uri.host ?? "URL"}>
										<Box component="span" sx={{ color: "var(--text-muted)" }}>
											{uri.uri}
										</Box>
									</FieldRow>
								))}
							</FieldCard>
						)}
					</>
				)}

				{item.type === CipherType.Card && item.card && (
					<FieldCard>
						{item.card.cardholderName && <FieldRow label="Cardholder">{item.card.cardholderName}</FieldRow>}
						{item.card.hasNumber && <FieldRow label="Number">{item.card.numberLast4 ? `•••• •••• •••• ${item.card.numberLast4}` : "Hidden"}</FieldRow>}
						{(item.card.expMonth || item.card.expYear) && (
							<FieldRow label="Expiration" mono>
								{item.card.expMonth?.padStart(2, "0") ?? "--"} / {item.card.expYear ?? "----"}
							</FieldRow>
						)}
						{item.card.brand && <FieldRow label="Brand">{item.card.brand}</FieldRow>}
					</FieldCard>
				)}

				{item.type === CipherType.Identity && item.identity && <IdentityFields identity={item.identity} />}

				{item.type === CipherType.SshKey && item.sshKey && (
					<FieldCard>
						{item.sshKey.publicKey && (
							<FieldRow label="Public key" mono>
								{item.sshKey.publicKey}
							</FieldRow>
						)}
						{item.sshKey.keyFingerprint && (
							<FieldRow label="Fingerprint" mono>
								{item.sshKey.keyFingerprint}
							</FieldRow>
						)}
					</FieldCard>
				)}

				{item.notes && (
					<FieldCard title="Notes">
						<FieldRow label="" multiline>
							{item.notes}
						</FieldRow>
					</FieldCard>
				)}

				{item.fields.length > 0 && (
					<FieldCard title="Custom fields">
						{item.fields.map((field, index) => {
							const label = field.name || `Champ ${index + 1}`;
							// Hidden values are secrets: only the name is shown
							if (field.type === FieldType.Hidden)
								return (
									<FieldRow key={index} label={label}>
										<Box component="span" sx={{ color: "var(--text-faint)" }}>
											Hidden value
										</Box>
									</FieldRow>
								);
							if (field.type === FieldType.Boolean)
								return (
									<FieldRow key={index} label={label}>
										{field.value === "true" ? "Oui" : "Non"}
									</FieldRow>
								);
							if (field.type === FieldType.Linked)
								return (
									<FieldRow key={index} label={label}>
										<Box component="span" sx={{ color: "var(--text-muted)" }}>
											Linked field
										</Box>
									</FieldRow>
								);
							return (
								<FieldRow key={index} label={label}>
									{field.value || (
										<Box component="span" sx={{ color: "var(--text-faint)" }}>
											—
										</Box>
									)}
								</FieldRow>
							);
						})}
					</FieldCard>
				)}
			</Box>

			<PurgeConfirmDialog
				open={confirming}
				title="Delete permanently?"
				message={`Permanently delete "${item.name}"? This cannot be undone.`}
				confirmLabel="Delete permanently"
				onConfirm={() => void purge()}
				onClose={() => setConfirming(false)}
			/>
		</Box>
	);
}
