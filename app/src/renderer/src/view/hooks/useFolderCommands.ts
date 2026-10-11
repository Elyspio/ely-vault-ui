import { useMemo } from "react";
import { store, useAppDispatch } from "@store";
import { showToast } from "@modules/ui/ui.reducer";
import { setFilter } from "@modules/vault/vault.reducer";
import { normalizeFolderPath } from "@modules/vault/vault.folders";
import { useVaultWrites } from "./useVaultWrites";

/**
 * Folder management of the sidebar: create, rename and delete, with the feedback toasts of `useVaultWrites`.
 * Each action resolves with the outcome of the write (null when it did not run), so the caller keeps its field open on errors.
 */
export function useFolderCommands() {
	const dispatch = useAppDispatch();
	const writes = useVaultWrites();

	return useMemo(
		() => ({
			async create(name: string) {
				const outcome = await writes.createFolder(name);
				if (outcome?.status === "success") dispatch(showToast(`Folder "${normalizeFolderPath(name)}" created`));
				return outcome;
			},

			/**
			 * Renames a folder and its sub folders. Folders keep their ids, so an active folder filter still shows the renamed folder.
			 */
			async rename(fullName: string, newName: string) {
				const newPath = normalizeFolderPath(newName);
				const outcome = await writes.renameFolder(fullName, newPath);
				if (outcome?.status === "success") dispatch(showToast(`Folder renamed to "${newPath}"`));
				return outcome;
			},

			/** Deleting the folder shown by the list falls back to "All items" */
			async remove(id: string, fullName: string) {
				const outcome = await writes.deleteFolder(id);
				if (outcome?.status !== "success") return outcome;

				dispatch(showToast(`Folder "${fullName}" deleted`));
				const { filter } = store.getState().vault;
				if (filter.kind === "folder" && filter.id === id) dispatch(setFilter({ kind: "all" }));
				return outcome;
			},
		}),
		[dispatch, writes]
	);
}
