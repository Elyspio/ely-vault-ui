import { FieldCard, FieldRow } from "./fields/FieldRow";
import type { IdentityKey } from "@shared/types/vault.types";
import { useTranslation } from "react-i18next";
import type { vault } from "@shared/i18n/en/vault";

/** Identity fields, grouped as in the official clients. Without copyText the rows are read-only. */
const identityRows: { label: keyof typeof vault.identity; keys: IdentityKey[]; separator?: string }[] = [
	{ label: "name", keys: ["title", "firstName", "middleName", "lastName"], separator: " " },
	{ label: "username", keys: ["username"] },
	{ label: "company", keys: ["company"] },
	{ label: "email", keys: ["email"] },
	{ label: "phone", keys: ["phone"] },
	{ label: "address", keys: ["address1", "address2", "address3"], separator: "\n" },
	{ label: "city", keys: ["postalCode", "city"], separator: " " },
	{ label: "stateCountry", keys: ["state", "country"], separator: ", " },
	{ label: "ssn", keys: ["ssn"] },
	{ label: "passport", keys: ["passportNumber"] },
	{ label: "license", keys: ["licenseNumber"] },
];

export function IdentityFields({ identity, copyText }: Readonly<{ identity: Record<IdentityKey, string | null>; copyText?: (value: string, label: string) => () => void }>) {
	const { t } = useTranslation("vault");
	return (
		<FieldCard>
			{identityRows.map(({ label: labelKey, keys, separator = "" }) => {
				const label = t(`identity.${labelKey}`);
				const value = keys
					.map((key) => identity[key])
					.filter(Boolean)
					.join(separator);
				if (!value) return null;
				return (
					<FieldRow key={labelKey} label={label} multiline={separator === "\n"} onCopy={copyText?.(value, label)}>
						{value}
					</FieldRow>
				);
			})}
		</FieldCard>
	);
}
