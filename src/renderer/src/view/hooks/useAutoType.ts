import { useEffect, useState } from "react";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { type AutoTypeAvailability, CipherType, type VaultItem } from "@shared/types/vault.types";

/** Asked once: it does not change while the application runs */
let availability: Promise<AutoTypeAvailability> | null = null;

/**
 * Whether auto-type works on this system (Wayland, missing xdotool...), null while unknown
 */
export function useAutoTypeAvailability() {
	const [value, setValue] = useState<AutoTypeAvailability | null>(null);

	useEffect(() => {
		let active = true;
		availability ??= webContainer
			.get(VaultService)
			.autoTypeAvailability()
			.catch((error: unknown) => ({ available: false, reason: ipcErrorMessage(error) }));
		void availability.then((result) => active && setValue(result));
		return () => {
			active = false;
		};
	}, []);

	return value;
}

/**
 * Logins with something to type
 */
export function canAutoType(item: VaultItem) {
	return item.type === CipherType.Login && Boolean(item.login?.username || item.login?.hasPassword);
}
