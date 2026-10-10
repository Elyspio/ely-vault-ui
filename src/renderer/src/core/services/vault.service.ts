import { injectable } from "inversify";
import type { CopyRef, SecretRef } from "@shared/types/vault.types";

@injectable()
export class VaultService {
	private readonly icons = new Map<string, Promise<string | null>>();

	public snapshot() {
		return window.preload.ipc.send.vault.snapshot();
	}

	public sync() {
		return window.preload.ipc.send.vault.sync();
	}

	public secret(itemId: string, ref: SecretRef) {
		return window.preload.ipc.send.vault.secret(itemId, ref);
	}

	public copy(itemId: string | null, ref: CopyRef) {
		return window.preload.ipc.send.vault.copy(itemId, ref);
	}

	public totp(itemId: string) {
		return window.preload.ipc.send.vault.totp(itemId);
	}

	public autoTypeAvailability() {
		return window.preload.ipc.send.autoType.availability();
	}

	public autoType(itemId: string) {
		return window.preload.ipc.send.autoType.perform(itemId);
	}

	public verifyReprompt(password: string) {
		return window.preload.ipc.send.vault.verifyReprompt(password);
	}

	public generatePassword(length: number) {
		return window.preload.ipc.send.vault.generatePassword(length);
	}

	/**
	 * Favicon of a host, requested once per session
	 */
	public icon(host: string) {
		let icon = this.icons.get(host);
		if (!icon) {
			icon = window.preload.ipc.send.vault.icon(host).catch(() => null);
			this.icons.set(host, icon);
		}
		return icon;
	}

	public openExternal(url: string) {
		return window.preload.ipc.send.app.openExternal(url);
	}
}
