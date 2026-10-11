import type { Dispatch, SetStateAction } from "react";
import { Box, TextField } from "@mui/material";
import { useVaultActions } from "@hooks/useVaultActions";
import type { ItemDraft, VaultItem } from "@shared/types/vault.types";
import { SecretInput } from "./SecretInput";
import { EditorSection } from "./EditorSection";

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
	item: VaultItem | null;
};

/**
 * Card values: holder, brand and expiration in clear, number and security code write-only
 */
export function CardFields({ draft, setDraft, item }: Readonly<Props>) {
	const actions = useVaultActions();
	const card = draft.card ?? { cardholderName: null, brand: null, expMonth: null, expYear: null };

	const patch = (changes: Partial<NonNullable<ItemDraft["card"]>>) => setDraft((current) => ({ ...current, card: { ...(current.card ?? card), ...changes } }));

	return (
		<EditorSection title="Card">
			<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
				<TextField label="Cardholder" size="small" value={card.cardholderName ?? ""} onChange={(event) => patch({ cardholderName: event.target.value })} />
				<TextField label="Brand" size="small" value={card.brand ?? ""} onChange={(event) => patch({ brand: event.target.value })} />
				<SecretInput
					label="Number"
					value={draft.card?.number}
					onChange={(number) => patch({ number })}
					stored={item?.card?.hasNumber ?? false}
					reveal={item ? () => actions.reveal(item.id, { kind: "cardNumber" }) : undefined}
				/>
				<SecretInput
					label="Security code"
					value={draft.card?.code}
					onChange={(code) => patch({ code })}
					stored={item?.card?.hasCode ?? false}
					reveal={item ? () => actions.reveal(item.id, { kind: "cardCode" }) : undefined}
				/>
				<TextField label="Expiration month" size="small" value={card.expMonth ?? ""} onChange={(event) => patch({ expMonth: event.target.value })} />
				<TextField label="Expiration year" size="small" value={card.expYear ?? ""} onChange={(event) => patch({ expYear: event.target.value })} />
			</Box>
		</EditorSection>
	);
}
