import { createAsyncActionGenerator, getServices } from "@store/utils/utils.actions";
import { VaultService } from "@services/vault.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import type { ItemDraft, WriteResult } from "@shared/types/vault.types";

const createAsyncThunk = createAsyncActionGenerator("vault/write");

/**
 * Write operations. They resolve with the {@link WriteResult} of the main process, whatever the outcome
 * (the reducer applies the reloaded snapshot); they reject only with the message of an error thrown by the
 * main process ("REPROMPT_REQUIRED", locked vault…), handled by `useVaultWrites`.
 */
function createWriteThunk<Arg>(suffix: string, run: (service: VaultService, arg: Arg) => Promise<WriteResult>) {
	return createAsyncThunk<WriteResult, Arg>(suffix, async (arg, { extra, rejectWithValue }) => {
		const services = getServices({ vault: VaultService }, extra);
		try {
			return await run(services.vault, arg);
		} catch (error) {
			return rejectWithValue(ipcErrorMessage(error)) as never;
		}
	});
}

export const createItem = createWriteThunk<ItemDraft>("item/create", (service, draft) => service.createItem(draft));

export const updateItem = createWriteThunk<{ itemId: string; revision: string; draft: ItemDraft }>("item/update", (service, { itemId, revision, draft }) =>
	service.updateItem(itemId, revision, draft)
);

export const deleteItem = createWriteThunk<string>("item/delete", (service, itemId) => service.deleteItem(itemId));

export const restoreItem = createWriteThunk<string>("item/restore", (service, itemId) => service.restoreItem(itemId));

export const purgeItems = createWriteThunk<string[]>("item/purge", (service, itemIds) => service.purgeItems(itemIds));

export const setFavorite = createWriteThunk<{ itemId: string; favorite: boolean }>("item/favorite", (service, { itemId, favorite }) => service.setFavorite(itemId, favorite));

export const moveItem = createWriteThunk<{ itemId: string; folderId: string | null }>("item/move", (service, { itemId, folderId }) => service.moveItem(itemId, folderId));

export const createFolder = createWriteThunk<string>("folder/create", (service, name) => service.createFolder(name));

export const renameFolder = createWriteThunk<{ path: string; newPath: string }>("folder/rename", (service, { path, newPath }) => service.renameFolder(path, newPath));

export const deleteFolder = createWriteThunk<string>("folder/delete", (service, folderId) => service.deleteFolder(folderId));

export const writeThunks = [createItem, updateItem, deleteItem, restoreItem, purgeItems, setFavorite, moveItem, createFolder, renameFolder, deleteFolder] as const;
