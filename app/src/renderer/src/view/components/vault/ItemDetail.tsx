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
import { useTranslation } from "react-i18next";
import type { vault } from "@shared/i18n/en/vault";

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
	const { t } = useTranslation(["vault", "common"]);

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
							{item.reprompt && <Chip size="small" icon={<LockPersonRounded />} label={t("detail.reprompt")} variant="outlined" color="warning" />}
						</Box>
					</Box>
					<Tooltip title={item.favorite ? t("detail.removeFavorite") : t("detail.addFavorite")}>
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
						<Tooltip title={autoType?.available === false ? autoType.reason : t("detail.autoTypeTooltip")}>
							<span>
								<Button
									variant="outlined"
									size="small"
									startIcon={<KeyboardRounded />}
									disabled={!autoType?.available}
									onClick={() => void actions.autoType(item.id)}
								>
									{t("detail.autoType")}
								</Button>
							</span>
						</Tooltip>
					)}
					{firstUri && (
						<Button variant="outlined" size="small" endIcon={<OpenInNewRounded />} onClick={() => void actions.open(firstUri.uri)}>
							{t("detail.open")}
						</Button>
					)}
					{isEditableItem(item) && (
						<Tooltip title={t("detail.editTooltip")}>
							<Button variant="outlined" size="small" startIcon={<EditRounded />} onClick={() => void commands.edit(item)}>
								{t("common:edit")}
							</Button>
						</Tooltip>
					)}
					<Tooltip title={t("detail.moveTooltip")}>
						<Button variant="outlined" size="small" startIcon={<FolderRounded />} onClick={() => commands.move(item)}>
							{t("detail.move")}
						</Button>
					</Tooltip>
					<Tooltip title={t("detail.deleteTooltip")}>
						<Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlineRounded />} onClick={() => void commands.remove(item)}>
							{t("common:delete")}
						</Button>
					</Tooltip>
				</Box>

				{item.type === CipherType.Login && item.login && (
					<>
						<FieldCard>
							{item.login.username && (
								<FieldRow label={t("fields.username")} onCopy={() => void actions.copy(item.id, { kind: "username" }, t("copied.username"))}>
									{item.login.username}
								</FieldRow>
							)}
							{item.login.hasPassword && <SecretRow label={t("fields.password")} itemId={item.id} secret={{ kind: "password" }} />}
							{item.login.hasTotp && <TotpRow itemId={item.id} reprompt={item.reprompt} />}
						</FieldCard>
						{item.login.uris.length > 0 && (
							<FieldCard title={t("fields.websites", { count: item.login.uris.length })}>
								{item.login.uris.map((uri, index) => (
									<FieldRow
										key={index}
										label={uri.host ?? "URL"}
										onCopy={() => void actions.copy(item.id, { kind: "uri", index }, t("copied.url"))}
										actions={
											uri.host && (
												<Tooltip title={t("fields.openInBrowser")}>
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
							<FieldRow label={t("fields.cardholder")} onCopy={copyText(item.card.cardholderName, t("fields.cardholder"))}>
								{item.card.cardholderName}
							</FieldRow>
						)}
						{item.card.hasNumber && (
							<SecretRow
								label={t("fields.number")}
								itemId={item.id}
								secret={{ kind: "cardNumber" }}
								maskedHint={item.card.numberLast4 ? `•••• •••• •••• ${item.card.numberLast4}` : undefined}
								colored={false}
							/>
						)}
						{(item.card.expMonth || item.card.expYear) && (
							<FieldRow label={t("fields.expiration")} mono onCopy={copyText(`${item.card.expMonth ?? ""}/${item.card.expYear ?? ""}`, t("fields.expiration"))}>
								{item.card.expMonth?.padStart(2, "0") ?? "--"} / {item.card.expYear ?? "----"}
							</FieldRow>
						)}
						{item.card.hasCode && <SecretRow label={t("fields.securityCode")} itemId={item.id} secret={{ kind: "cardCode" }} colored={false} />}
						{item.card.brand && <FieldRow label={t("fields.brand")}>{item.card.brand}</FieldRow>}
					</FieldCard>
				)}

				{item.type === CipherType.Identity && item.identity && <IdentityFields identity={item.identity} copyText={copyText} />}

				{item.type === CipherType.SshKey && item.sshKey && (
					<FieldCard>
						{item.sshKey.publicKey && (
							<FieldRow label={t("fields.publicKey")} mono onCopy={copyText(item.sshKey.publicKey, t("fields.publicKey"))}>
								{item.sshKey.publicKey}
							</FieldRow>
						)}
						{item.sshKey.keyFingerprint && (
							<FieldRow label={t("fields.fingerprint")} mono onCopy={copyText(item.sshKey.keyFingerprint, t("fields.fingerprint"))}>
								{item.sshKey.keyFingerprint}
							</FieldRow>
						)}
						{item.sshKey.hasPrivateKey && <SecretRow label={t("fields.privateKey")} itemId={item.id} secret={{ kind: "sshPrivateKey" }} multiline />}
					</FieldCard>
				)}

				{item.notes && (
					<FieldCard title={t("fields.notes")}>
						<FieldRow label="" multiline onCopy={() => void actions.copy(item.id, { kind: "notes" }, t("copied.note"))}>
							{item.notes}
						</FieldRow>
					</FieldCard>
				)}

				{item.fields.length > 0 && (
					<FieldCard title={t("fields.customFields")}>
						{item.fields.map((field, index) => {
							const label = field.name || t("fields.fieldFallback", { number: index + 1 });
							if (field.type === FieldType.Hidden) return <SecretRow key={index} label={label} itemId={item.id} secret={{ kind: "field", index }} />;
							if (field.type === FieldType.Boolean)
								return (
									<FieldRow key={index} label={label}>
										{field.value === "true" ? t("fields.yes") : t("fields.no")}
									</FieldRow>
								);
							if (field.type === FieldType.Linked)
								return (
									<FieldRow key={index} label={label}>
										<Box component="span" sx={{ color: "var(--text-muted)" }}>
											{t("fields.linkedField")}
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
					<Meta label={t("detail.modified")} value={formatDateTime(item.revisionDate)} />
					{item.creationDate && <Meta label={t("detail.created")} value={formatDateTime(item.creationDate)} />}
					{item.login?.passwordRevisionDate && <Meta label={t("detail.passwordChanged")} value={formatDateTime(item.login.passwordRevisionDate)} />}
					{item.passwordHistoryCount > 0 && <Meta label={t("detail.history")} value={t("detail.oldPasswords", { count: item.passwordHistoryCount })} />}
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

const shortcuts: [string[], keyof typeof vault.empty.shortcuts][] = [
	[["Ctrl", "K"], "palette"],
	[["Ctrl", "F"], "filter"],
	[["↑", "↓"], "browse"],
	[["Enter"], "copyPassword"],
	[["Ctrl", "Shift", "U"], "copyUsername"],
	[["Ctrl", "Shift", "O"], "copyTotp"],
	[["Ctrl", "L"], "lock"],
];

function EmptyDetail() {
	const { t } = useTranslation("vault");
	return (
		<Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ textAlign: "center" }}>
				<Logo size={64} sx={{ mx: "auto", mb: 1.5, opacity: 0.25, filter: "grayscale(0.6)" }} />
				<Typography sx={{ color: "var(--text-muted)", mb: 3 }}>{t("empty.selectItem")}</Typography>
				<Box sx={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 2, rowGap: 1, alignItems: "center", textAlign: "left" }}>
					{shortcuts.map(([keys, label]) => (
						<Box key={label} sx={{ display: "contents" }}>
							<Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
								{keys.map((key) => (
									<Kbd key={key}>{key}</Kbd>
								))}
							</Box>
							<Typography sx={{ fontSize: "0.78rem", color: "var(--text-faint)" }}>{t(`empty.shortcuts.${label}`)}</Typography>
						</Box>
					))}
				</Box>
			</Box>
		</Box>
	);
}
