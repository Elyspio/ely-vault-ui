import type { Dispatch, SetStateAction } from "react";
import { Box, TextField } from "@mui/material";
import type { IdentityKey, ItemDraft } from "@shared/types/vault.types";
import { EditorSection } from "./EditorSection";

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
};

/** Readable labels, grouped like the detail view of an identity */
const identityGroups: { title: string; fields: { key: IdentityKey; label: string }[] }[] = [
	{
		title: "Name",
		fields: [
			{ key: "title", label: "Title" },
			{ key: "firstName", label: "First name" },
			{ key: "middleName", label: "Middle name" },
			{ key: "lastName", label: "Last name" },
		],
	},
	{
		title: "Contact",
		fields: [
			{ key: "username", label: "Username" },
			{ key: "company", label: "Company" },
			{ key: "email", label: "E-mail" },
			{ key: "phone", label: "Phone" },
		],
	},
	{
		title: "Address",
		fields: [
			{ key: "address1", label: "Address line 1" },
			{ key: "address2", label: "Address line 2" },
			{ key: "address3", label: "Address line 3" },
			{ key: "city", label: "City" },
			{ key: "state", label: "State / Province" },
			{ key: "postalCode", label: "Postal code" },
			{ key: "country", label: "Country" },
		],
	},
	{
		title: "Documents",
		fields: [
			{ key: "ssn", label: "Social security number" },
			{ key: "passportNumber", label: "Passport number" },
			{ key: "licenseNumber", label: "License number" },
		],
	},
];

/**
 * Identity values: plain text, grouped
 */
export function IdentityFields({ draft, setDraft }: Readonly<Props>) {
	const identity = draft.identity ?? {};

	const setValue = (key: IdentityKey, value: string) =>
		setDraft((current) => ({ ...current, identity: { ...current.identity, [key]: value } as Record<IdentityKey, string | null> }));

	return (
		<>
			{identityGroups.map((group) => (
				<EditorSection key={group.title} title={group.title}>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
						{group.fields.map(({ key, label }) => (
							<TextField
								key={key}
								label={label}
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
