import { useCallback } from "react";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { useVaultActions } from "@hooks/useVaultActions";

/**
 * The value copied by Enter / double-click: the password of a login, the number of a card, the notes of a note...
 */
export function usePrimaryCopy() {
	const actions = useVaultActions();

	return useCallback(
		async (item: VaultItem) => {
			switch (item.type) {
				case CipherType.Login:
					if (item.login?.hasPassword) return actions.copy(item.id, { kind: "password" }, "Password");
					if (item.login?.username) return actions.copy(item.id, { kind: "username" }, "Username");
					return;
				case CipherType.Card:
					if (item.card?.hasNumber) return actions.copy(item.id, { kind: "cardNumber" }, "Card number");
					return;
				case CipherType.SecureNote:
					if (item.notes) return actions.copy(item.id, { kind: "notes" }, "Note");
					return;
				case CipherType.SshKey:
					if (item.sshKey?.publicKey) return actions.copy(null, { kind: "text", value: item.sshKey.publicKey }, "Public key");
					return;
				case CipherType.Identity:
					if (item.identity?.email) return actions.copy(null, { kind: "text", value: item.identity.email }, "E-mail");
					return;
			}
		},
		[actions]
	);
}
