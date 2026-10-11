import { FieldCard, FieldRow } from "./fields/FieldRow";
import type { IdentityKey } from "@shared/types/vault.types";

/** Identity fields, grouped as in the official clients. Without copyText the rows are read-only. */
const identityRows: { label: string; keys: IdentityKey[]; separator?: string }[] = [
	{ label: "Name", keys: ["title", "firstName", "middleName", "lastName"], separator: " " },
	{ label: "Username", keys: ["username"] },
	{ label: "Company", keys: ["company"] },
	{ label: "E-mail", keys: ["email"] },
	{ label: "Phone", keys: ["phone"] },
	{ label: "Address", keys: ["address1", "address2", "address3"], separator: "\n" },
	{ label: "City", keys: ["postalCode", "city"], separator: " " },
	{ label: "State / Country", keys: ["state", "country"], separator: ", " },
	{ label: "Social security number", keys: ["ssn"] },
	{ label: "Passport number", keys: ["passportNumber"] },
	{ label: "License number", keys: ["licenseNumber"] },
];

export function IdentityFields({ identity, copyText }: Readonly<{ identity: Record<IdentityKey, string | null>; copyText?: (value: string, label: string) => () => void }>) {
	return (
		<FieldCard>
			{identityRows.map(({ label, keys, separator = "" }) => {
				const value = keys
					.map((key) => identity[key])
					.filter(Boolean)
					.join(separator);
				if (!value) return null;
				return (
					<FieldRow key={label} label={label} multiline={separator === "\n"} onCopy={copyText?.(value, label)}>
						{value}
					</FieldRow>
				);
			})}
		</FieldCard>
	);
}
