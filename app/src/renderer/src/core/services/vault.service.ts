import { injectable } from "inversify";
import type { CopyRef, ItemDraft, PasswordGeneratorOptions, SecretRef } from "@shared/types/vault.types";

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

	public createItem(draft: ItemDraft) {
		return window.preload.ipc.send.vault.createItem(draft);
	}

	public updateItem(itemId: string, expectedRevision: string, draft: ItemDraft) {
		return window.preload.ipc.send.vault.updateItem(itemId, expectedRevision, draft);
	}

	public deleteItem(itemId: string) {
		return window.preload.ipc.send.vault.deleteItem(itemId);
	}

	public restoreItem(itemId: string) {
		return window.preload.ipc.send.vault.restoreItem(itemId);
	}

	public purgeItems(itemIds: string[]) {
		return window.preload.ipc.send.vault.purgeItems(itemIds);
	}

	public setFavorite(itemId: string, favorite: boolean) {
		return window.preload.ipc.send.vault.setFavorite(itemId, favorite);
	}

	public moveItem(itemId: string, folderId: string | null) {
		return window.preload.ipc.send.vault.moveItem(itemId, folderId);
	}

	public createFolder(name: string) {
		return window.preload.ipc.send.vault.createFolder(name);
	}

	public renameFolder(path: string, newPath: string) {
		return window.preload.ipc.send.vault.renameFolder(path, newPath);
	}

	public deleteFolder(folderId: string) {
		return window.preload.ipc.send.vault.deleteFolder(folderId);
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

	public generatePassword(options: PasswordGeneratorOptions) {
		return window.preload.ipc.send.vault.generatePassword(options);
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
