import { type Dispatch, type SetStateAction, useState } from "react";
import { Box, Button, Menu, MenuItem } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import { useTranslation } from "react-i18next";
import { useVaultActions } from "@hooks/useVaultActions";
import { FieldType, type DraftField, type ItemDraft, type SecretChange, type VaultItem } from "@shared/types/vault.types";
import { toSecretChange } from "@view/utils/draft.utils";
import { CustomFieldRow, fieldTypeKeys } from "./CustomFieldRow";
import { EditorSection } from "./EditorSection";

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
	item: VaultItem | null;
};

/**
 * Custom fields of the item: add, remove, reorder, rename and change the type of the non-linked ones.
 * A hidden field of an organization item without a visible value is locked (the CLI matches it by name and order).
 */
export function CustomFields({ draft, setDraft, item }: Readonly<Props>) {
	const { t } = useTranslation("editor");
	const actions = useVaultActions();
	const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
	// Rows are keyed by position: bumped on structural changes so a revealed secret never stays on another field
	const [layout, setLayout] = useState(0);

	const originalOf = (field: DraftField) => (field.originalIndex === null ? undefined : item?.fields[field.originalIndex]);
	const isLocked = (field: DraftField) => {
		const original = originalOf(field);
		return Boolean(item?.organizationId && original?.type === FieldType.Hidden && !original.hasValue);
	};

	/** Replaces the field object (identity, the list may have moved while an async step ran) */
	const replace = (field: DraftField, next: DraftField | null) => {
		if (!next) setLayout((value) => value + 1);
		setDraft((current) => ({
			...current,
			fields: next ? current.fields.map((candidate) => (candidate === field ? next : candidate)) : current.fields.filter((candidate) => candidate !== field),
		}));
	};

	const move = (index: number, direction: -1 | 1) => {
		setLayout((value) => value + 1);
		setDraft((current) => {
			const fields = [...current.fields];
			const target = index + direction;
			[fields[index], fields[target]] = [fields[target], fields[index]];
			return { ...current, fields };
		});
	};

	const add = (type: FieldType) => {
		setAddAnchor(null);
		const field: DraftField = { originalIndex: null, name: "", type };
		if (type === FieldType.Text) field.value = "";
		if (type === FieldType.Boolean) field.value = "false";
		setDraft((current) => ({ ...current, fields: [...current.fields, field] }));
	};

	/**
	 * Changes the type of a field. Going from hidden to visible needs the stored value: it is revealed first
	 * (the reveal can be cancelled, then nothing changes).
	 */
	const changeType = async (field: DraftField, type: FieldType) => {
		if (field.type === type || field.type === FieldType.Linked) return;

		let current: string | null;
		if (field.type !== FieldType.Hidden) current = field.value ?? null;
		else if (field.secret) current = field.secret.kind === "set" ? field.secret.value : null;
		else if (item && field.originalIndex !== null && originalOf(field)?.hasValue) {
			const revealed = await actions.reveal(item.id, { kind: "field", index: field.originalIndex });
			if (revealed === null) return;
			current = revealed;
		} else current = null;

		const base = { originalIndex: field.originalIndex, name: field.name };
		if (type === FieldType.Hidden) replace(field, { ...base, type, secret: toSecretChange(current ?? "") });
		else if (type === FieldType.Boolean) replace(field, { ...base, type, value: current === "true" ? "true" : "false" });
		else replace(field, { ...base, type, value: current });
	};

	return (
		<EditorSection title={t("fields.title")}>
			{draft.fields.length === 0 && <Box sx={{ color: "var(--text-faint)", fontSize: "0.85rem", mb: 1 }}>{t("fields.empty")}</Box>}
			{draft.fields.map((field, index) => {
				const original = originalOf(field);
				return (
					<CustomFieldRow
						key={`${layout}-${index}`}
						field={field}
						stored={original?.hasValue ?? false}
						locked={isLocked(field)}
						canMoveUp={index > 0}
						canMoveDown={index < draft.fields.length - 1}
						onRename={(name) => replace(field, { ...field, name })}
						onChangeType={(type) => void changeType(field, type)}
						onValue={(value) => replace(field, { ...field, value })}
						onSecret={(secret: SecretChange | undefined) => replace(field, { ...field, secret })}
						reveal={item && field.originalIndex !== null ? () => actions.reveal(item.id, { kind: "field", index: field.originalIndex! }) : undefined}
						onMove={(direction) => move(index, direction)}
						onRemove={() => replace(field, null)}
					/>
				);
			})}
			<Button size="small" startIcon={<AddRounded />} onClick={(event) => setAddAnchor(event.currentTarget)} sx={{ mt: 1 }}>
				{t("fields.add")}
			</Button>
			<Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
				{[FieldType.Text, FieldType.Hidden, FieldType.Boolean].map((type) => (
					<MenuItem key={type} onClick={() => add(type)}>
						{t(`fields.types.${fieldTypeKeys[type]}`)}
					</MenuItem>
				))}
			</Menu>
		</EditorSection>
	);
}
