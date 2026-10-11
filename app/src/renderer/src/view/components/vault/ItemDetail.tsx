import { Box, Button, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import StarOutlineRounded from "@mui/icons-material/StarOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import LockPersonRounded from "@mui/icons-material/LockPersonRounded";
import KeyboardRounded from "@mui/icons-material/KeyboardRounded";
import { useAppSelector } from "@store";
import { selectSelectedItem } from "@modules/vault/vault.selectors";
import { CipherType, FieldType, type VaultItem } from "@shared/types/vault.types";
import { useVaultActions } from "@hooks/useVaultActions";
import { isEditableItem, useItemCommands } from "@hooks/useItemCommands";
import { canAutoType, useAutoTypeAvailability } from "@hooks/useAutoType";
import { ItemIcon } from "./ItemIcon";
import { FieldCard, FieldRow } from "./fields/FieldRow";
import { SecretRow } from "./fields/SecretRow";
import { TotpRow } from "./fields/TotpRow";
import { Kbd } from "@components/shared/Kbd";
import { Logo } from "@components/shared/Logo";
import { formatDateTime } from "@view/utils/date.utils";
import { IdentityFields } from "./IdentityFields";
import { TrashItemDetail } from "./trash/TrashItemDetail";
import { ItemEditor } from "./editor/ItemEditor";

export function ItemDetail() {
	const editing = useAppSelector((state) => state.vault.editor !== null);
	const item = useAppSelector(selectSelectedItem);

	// The editor takes the whole panel, create mode included (nothing selected)
	if (editing) return <ItemEditor />;
	if (!item) return <EmptyDetail />;

	// Deleted items get their own read-only view: no secret is ever rendered for them
	if (item.deletedDate) return <TrashItemDetail key={item.id} item={item} />;

	// Keyed by item: revealed secrets never leak from one item to the next
	return <Detail key={item.id} item={item} />;
}

function Detail({ item }: Readonly<{ item: VaultItem }>) {
	const actions = useVaultActions();
	const snapshot = useAppSelector((state) => state.vault.snapshot);
	const folder = snapshot?.folders.find((f) => f.id === item.folderId);
	const organization = snapshot?.organizations.find((o) => o.id === item.organizationId);
	const firstUri = item.login?.uris.find((u) => u.host);
	const autoType = useAutoTypeAvailability();
	const commands = useItemCommands();

	const copyText = (value: string, label: string) => () => void actions.copy(null, { kind: "text", value }, label);

	return (
		<Box sx={{ height: "100%", overflow: "auto", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ maxWidth: 720, mx: "auto", px: 4, py: 3.5, animation: "fadeIn 150ms ease" }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
					<ItemIcon item={item} size={52} />
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
							<Typography variant="h5" noWrap>
								{item.name}
							</Typography>
						</Box>
						<Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
							{folder && <Chip size="small" icon={<FolderRounded />} label={folder.name} variant="outlined" sx={{ borderColor: "var(--border-subtle)" }} />}
							{organization && (
								<Chip size="small" icon={<BusinessRounded />} label={organization.name} variant="outlined" sx={{ borderColor: "var(--border-subtle)" }} />
							)}
							{item.reprompt && <Chip size="small" icon={<LockPersonRounded />} label="Protected by the master password" variant="outlined" color="warning" />}
						</Box>
					</Box>
					<Tooltip title={item.favorite ? "Remove from favorites (Ctrl+D)" : "Add to favorites (Ctrl+D)"}>
						<IconButton
							size="small"
							aria-pressed={item.favorite}
							onClick={() => void commands.toggleFavorite(item)}
							sx={{ color: item.favorite ? "warning.main" : "var(--text-muted)" }}
						>
							{item.favorite ? <StarRounded /> : <StarOutlineRounded />}
						</IconButton>
					</Tooltip>
				</Box>
				<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3.5 }}>
					{canAutoType(item) && (
						<Tooltip title={autoType?.available === false ? autoType.reason : "Types the username and password into the previous window (Ctrl+V)"}>
							<span>
								<Button
									variant="outlined"
									size="small"
									startIcon={<KeyboardRounded />}
									disabled={!autoType?.available}
									onClick={() => void actions.autoType(item.id)}
								>
									Auto-type
								</Button>
							</span>
						</Tooltip>
					)}
					{firstUri && (
						<Button variant="outlined" size="small" endIcon={<OpenInNewRounded />} onClick={() => void actions.open(firstUri.uri)}>
							Open
						</Button>
					)}
					{isEditableItem(item) && (
						<Tooltip title="Edit (Ctrl+E)">
							<Button variant="outlined" size="small" startIcon={<EditRounded />} onClick={() => void commands.edit(item)}>
								Edit
							</Button>
						</Tooltip>
					)}
					<Tooltip title="Move to the trash (Del)">
						<Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlineRounded />} onClick={() => void commands.remove(item)}>
							Delete
						</Button>
					</Tooltip>
				</Box>

				{item.type === CipherType.Login && item.login && (
					<>
						<FieldCard>
							{item.login.username && (
								<FieldRow label="Username" onCopy={() => void actions.copy(item.id, { kind: "username" }, "Username")}>
									{item.login.username}
								</FieldRow>
							)}
							{item.login.hasPassword && <SecretRow label="Password" itemId={item.id} secret={{ kind: "password" }} />}
							{item.login.hasTotp && <TotpRow itemId={item.id} reprompt={item.reprompt} />}
						</FieldCard>
						{item.login.uris.length > 0 && (
							<FieldCard title={item.login.uris.length > 1 ? "Websites" : "Website"}>
								{item.login.uris.map((uri, index) => (
									<FieldRow
										key={index}
										label={uri.host ?? "URL"}
										onCopy={() => void actions.copy(item.id, { kind: "uri", index }, "URL")}
										actions={
											uri.host && (
												<Tooltip title="Open in the browser">
													<IconButton size="small" onClick={() => void actions.open(uri.uri)}>
														<OpenInNewRounded sx={{ fontSize: 16 }} />
													</IconButton>
												</Tooltip>
											)
										}
									>
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
						{item.card.cardholderName && (
							<FieldRow label="Cardholder" onCopy={copyText(item.card.cardholderName, "Cardholder")}>
								{item.card.cardholderName}
							</FieldRow>
						)}
						{item.card.hasNumber && (
							<SecretRow
								label="Number"
								itemId={item.id}
								secret={{ kind: "cardNumber" }}
								maskedHint={item.card.numberLast4 ? `•••• •••• •••• ${item.card.numberLast4}` : undefined}
								colored={false}
							/>
						)}
						{(item.card.expMonth || item.card.expYear) && (
							<FieldRow label="Expiration" mono onCopy={copyText(`${item.card.expMonth ?? ""}/${item.card.expYear ?? ""}`, "Expiration")}>
								{item.card.expMonth?.padStart(2, "0") ?? "--"} / {item.card.expYear ?? "----"}
							</FieldRow>
						)}
						{item.card.hasCode && <SecretRow label="Security code" itemId={item.id} secret={{ kind: "cardCode" }} colored={false} />}
						{item.card.brand && <FieldRow label="Brand">{item.card.brand}</FieldRow>}
					</FieldCard>
				)}

				{item.type === CipherType.Identity && item.identity && <IdentityFields identity={item.identity} copyText={copyText} />}

				{item.type === CipherType.SshKey && item.sshKey && (
					<FieldCard>
						{item.sshKey.publicKey && (
							<FieldRow label="Public key" mono onCopy={copyText(item.sshKey.publicKey, "Public key")}>
								{item.sshKey.publicKey}
							</FieldRow>
						)}
						{item.sshKey.keyFingerprint && (
							<FieldRow label="Fingerprint" mono onCopy={copyText(item.sshKey.keyFingerprint, "Fingerprint")}>
								{item.sshKey.keyFingerprint}
							</FieldRow>
						)}
						{item.sshKey.hasPrivateKey && <SecretRow label="Private key" itemId={item.id} secret={{ kind: "sshPrivateKey" }} multiline />}
					</FieldCard>
				)}

				{item.notes && (
					<FieldCard title="Notes">
						<FieldRow label="" multiline onCopy={() => void actions.copy(item.id, { kind: "notes" }, "Note")}>
							{item.notes}
						</FieldRow>
					</FieldCard>
				)}

				{item.fields.length > 0 && (
					<FieldCard title="Custom fields">
						{item.fields.map((field, index) => {
							const label = field.name || `Champ ${index + 1}`;
							if (field.type === FieldType.Hidden) return <SecretRow key={index} label={label} itemId={item.id} secret={{ kind: "field", index }} />;
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
								<FieldRow key={index} label={label} onCopy={field.value ? copyText(field.value, label) : undefined}>
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

				<Box sx={{ mt: 3, px: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
					<Meta label="Modified" value={formatDateTime(item.revisionDate)} />
					{item.creationDate && <Meta label="Created" value={formatDateTime(item.creationDate)} />}
					{item.login?.passwordRevisionDate && <Meta label="Password changed" value={formatDateTime(item.login.passwordRevisionDate)} />}
					{item.passwordHistoryCount > 0 && <Meta label="History" value={`${item.passwordHistoryCount} old password${item.passwordHistoryCount > 1 ? "s" : ""}`} />}
				</Box>
			</Box>
		</Box>
	);
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
	return (
		<Typography sx={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
			{label} : <span style={{ color: "var(--text-muted)" }}>{value}</span>
		</Typography>
	);
}

const shortcuts: [string[], string][] = [
	[["Ctrl", "K"], "Search and copy anywhere"],
	[["Ctrl", "F"], "Filter the list"],
	[["↑", "↓"], "Browse the items"],
	[["Enter"], "Copy the password"],
	[["Ctrl", "Shift", "U"], "Copy the username"],
	[["Ctrl", "Shift", "O"], "Copy the TOTP code"],
	[["Ctrl", "L"], "Lock"],
];

function EmptyDetail() {
	return (
		<Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ textAlign: "center" }}>
				<Logo size={64} sx={{ mx: "auto", mb: 1.5, opacity: 0.25, filter: "grayscale(0.6)" }} />
				<Typography sx={{ color: "var(--text-muted)", mb: 3 }}>Select an item</Typography>
				<Box sx={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 2, rowGap: 1, alignItems: "center", textAlign: "left" }}>
					{shortcuts.map(([keys, label]) => (
						<Box key={label} sx={{ display: "contents" }}>
							<Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
								{keys.map((key) => (
									<Kbd key={key}>{key}</Kbd>
								))}
							</Box>
							<Typography sx={{ fontSize: "0.78rem", color: "var(--text-faint)" }}>{label}</Typography>
						</Box>
					))}
				</Box>
			</Box>
		</Box>
	);
}
