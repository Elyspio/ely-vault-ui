import type { Dispatch, SetStateAction } from "react";
import { Box, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { IdentityKey, ItemDraft } from "@shared/types/vault.types";
import { EditorSection } from "./EditorSection";

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
};

/** Fields grouped like the detail view of an identity; labels in `editor:identity` */
const identityGroups: { title: "name" | "contact" | "address" | "documents"; fields: IdentityKey[] }[] = [
	{ title: "name", fields: ["title", "firstName", "middleName", "lastName"] },
	{ title: "contact", fields: ["username", "company", "email", "phone"] },
	{ title: "address", fields: ["address1", "address2", "address3", "city", "state", "postalCode", "country"] },
	{ title: "documents", fields: ["ssn", "passportNumber", "licenseNumber"] },
];

/**
 * Identity values: plain text, grouped
 */
export function IdentityFields({ draft, setDraft }: Readonly<Props>) {
	const { t } = useTranslation("editor");
	const identity = draft.identity ?? {};

	const setValue = (key: IdentityKey, value: string) =>
		setDraft((current) => ({ ...current, identity: { ...current.identity, [key]: value } as Record<IdentityKey, string | null> }));

	return (
		<>
			{identityGroups.map((group) => (
				<EditorSection key={group.title} title={t(`identity.groups.${group.title}`)}>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
						{group.fields.map((key) => (
							<TextField
								key={key}
								label={t(`identity.fields.${key}`)}
								size="small"
								value={identity[key] ?? ""}
								onChange={(event) => setValue(key, event.target.value)}
								sx={key.startsWith("address") ? { gridColumn: "1 / -1" } : undefined}
							/>
						))}
					</Box>
				</EditorSection>
			))}
		</>
	);
}
