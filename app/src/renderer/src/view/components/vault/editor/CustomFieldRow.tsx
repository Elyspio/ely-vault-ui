import { Box, IconButton, MenuItem, Switch, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { useTranslation } from "react-i18next";
import { FieldType, type DraftField, type SecretChange } from "@shared/types/vault.types";
import { SecretInput } from "./SecretInput";

type Props = {
	field: DraftField;
	/** Item already has a value for this hidden field */
	stored: boolean;
	/** Protected by the organization: the name, type, position and presence cannot change */
	locked: boolean;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onRename: (name: string) => void;
	onChangeType: (type: FieldType) => void;
	onValue: (value: string | null) => void;
	onSecret: (secret: SecretChange | undefined) => void;
	/** Reveals the stored value of the field, null when not available */
	reveal?: () => Promise<string | null>;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
};

/** Key of each field type in the `editor:fields.types` texts */
export const fieldTypeKeys = {
	[FieldType.Text]: "text",
	[FieldType.Hidden]: "hidden",
	[FieldType.Boolean]: "boolean",
	[FieldType.Linked]: "linked",
} as const satisfies Record<FieldType, string>;

/**
 * One custom field: name, type and value. Linked fields are read-only except for their name.
 */
export function CustomFieldRow({ field, stored, locked, canMoveUp, canMoveDown, onRename, onChangeType, onValue, onSecret, reveal, onMove, onRemove }: Readonly<Props>) {
	const { t } = useTranslation("editor");
	const linked = field.type === FieldType.Linked;

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, py: 1, "&:not(:last-of-type)": { borderBottom: "1px solid var(--border-subtle)" } }}>
			<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
				<TextField
					select
					size="small"
					aria-label={t("fields.type")}
					value={field.type}
					disabled={linked || locked}
					onChange={(event) => onChangeType(Number(event.target.value) as FieldType)}
					sx={{ width: 120 }}
				>
					{[FieldType.Text, FieldType.Hidden, FieldType.Boolean, FieldType.Linked]
						.filter((type) => type !== FieldType.Linked || linked)
						.map((type) => (
							<MenuItem key={type} value={type}>
								{t(`fields.types.${fieldTypeKeys[type]}`)}
							</MenuItem>
						))}
				</TextField>
				<TextField size="small" label={t("fields.name")} value={field.name} disabled={locked} onChange={(event) => onRename(event.target.value)} sx={{ flex: 1 }} />
				<Tooltip title={t("row.moveUp")}>
					<span>
						<IconButton size="small" disabled={!canMoveUp || locked} onClick={() => onMove(-1)}>
							<KeyboardArrowUpRounded />
						</IconButton>
					</span>
				</Tooltip>
				<Tooltip title={t("row.moveDown")}>
					<span>
						<IconButton size="small" disabled={!canMoveDown || locked} onClick={() => onMove(1)}>
							<KeyboardArrowDownRounded />
						</IconButton>
					</span>
				</Tooltip>
				<Tooltip title={locked ? t("fields.protected") : t("row.remove")}>
					<span>
						<IconButton size="small" disabled={locked} onClick={onRemove}>
							<DeleteOutlineRounded />
						</IconButton>
					</span>
				</Tooltip>
			</Box>

			{field.type === FieldType.Text && (
				<TextField size="small" label={t("fields.value")} fullWidth value={field.value ?? ""} onChange={(event) => onValue(event.target.value)} />
			)}
			{field.type === FieldType.Boolean && (
				<Box>
					<Switch checked={field.value === "true"} onChange={(_, checked) => onValue(checked ? "true" : "false")} />
					<Typography component="span" sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
						{field.value === "true" ? t("fields.yes") : t("fields.no")}
					</Typography>
				</Box>
			)}
			{field.type === FieldType.Hidden && <SecretInput label={t("fields.value")} value={field.secret} onChange={onSecret} stored={stored} reveal={reveal} />}
			{linked && <Typography sx={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t("fields.linkedReadOnly")}</Typography>}
			{locked && <Typography sx={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>{t("fields.protected")}</Typography>}
		</Box>
	);
}
