import { useCallback } from "react";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { useVaultActions } from "@hooks/useVaultActions";
import { useTranslation } from "react-i18next";

/**
 * The value copied by Enter / double-click: the password of a login, the number of a card, the notes of a note...
 */
export function usePrimaryCopy() {
	const actions = useVaultActions();
	const { t } = useTranslation("vault");

	return useCallback(
		async (item: VaultItem) => {
			// Items of the trash are read-only: nothing is copied from them
			if (item.deletedDate) return;
			switch (item.type) {
				case CipherType.Login:
					if (item.login?.hasPassword) return actions.copy(item.id, { kind: "password" }, t("copied.password"));
					if (item.login?.username) return actions.copy(item.id, { kind: "username" }, t("copied.username"));
					return;
				case CipherType.Card:
					if (item.card?.hasNumber) return actions.copy(item.id, { kind: "cardNumber" }, t("copied.cardNumber"));
					return;
				case CipherType.SecureNote:
					if (item.notes) return actions.copy(item.id, { kind: "notes" }, t("copied.note"));
					return;
				case CipherType.SshKey:
					if (item.sshKey?.publicKey) return actions.copy(null, { kind: "text", value: item.sshKey.publicKey }, t("copied.publicKey"));
					return;
				case CipherType.Identity:
					if (item.identity?.email) return actions.copy(null, { kind: "text", value: item.identity.email }, t("copied.email"));
					return;
			}
		},
		[actions, t]
	);
}
