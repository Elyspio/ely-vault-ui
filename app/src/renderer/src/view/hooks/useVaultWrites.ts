import { useContext, useMemo } from "react";
import { useAppDispatch } from "@store";
import { showToast } from "@modules/ui/ui.reducer";
import { createFolder, createItem, deleteFolder, deleteItem, moveItem, purgeItems, renameFolder, restoreItem, setFavorite, updateItem } from "@modules/vault/vault.write.actions";
import type { ItemDraft, WriteOutcome, WriteResult } from "@shared/types/vault.types";
import { RepromptContext } from "./useVaultActions";

/**
 * Write operations with the master password reprompt and the feedback toasts.
 *
 * Each action resolves with the outcome of the write, or null when it did not run (reprompt cancelled, error thrown
 * by the main process, already reported in a toast). Success toasts are left to the caller, except where noted.
 */
export function useVaultWrites() {
	const requestReprompt = useContext(RepromptContext);
	const dispatch = useAppDispatch();

	return useMemo(() => {
		/**
		 * Runs a write thunk; retried once the master password is confirmed when the item asks for it
		 */
		async function run(start: () => Promise<{ payload: unknown; meta: { requestStatus: "fulfilled" | "rejected" } }>): Promise<WriteOutcome | null> {
			const action = await start();
			if (action.meta.requestStatus === "rejected") {
				const message = typeof action.payload === "string" ? action.payload : "Unknown error";
				if (message === "REPROMPT_REQUIRED") return (await requestReprompt()) ? run(start) : null;
				dispatch(showToast(message, "error"));
				return null;
			}

			const result = action.payload as WriteResult;
			report(result);
			return result.outcome;
		}

		/** Errors of the write and of the reload that follows */
		function report({ outcome, refreshError }: WriteResult) {
			if (outcome.status === "error") dispatch(showToast(outcome.message, "error"));
			else if (outcome.status === "partial") dispatch(showToast(`Stopped after ${outcome.done.length} change(s): ${outcome.failed.message}`, "error"));
			else if (refreshError) dispatch(showToast(`Saved, but the vault could not be reloaded: ${refreshError}`, "error"));
		}

		return {
			createItem: (draft: ItemDraft) => run(() => dispatch(createItem(draft))),
			/** A `conflict` outcome is returned without toast: the editor explains it */
			updateItem: (itemId: string, revision: string, draft: ItemDraft) => run(() => dispatch(updateItem({ itemId, revision, draft }))),
			/** Moves to the trash, with an "Undo" toast */
			async deleteItem(itemId: string, name: string) {
				const outcome = await run(() => dispatch(deleteItem(itemId)));
				if (outcome?.status === "success") dispatch(showToast(`"${name}" moved to the trash`, "info", { label: "Undo", kind: "restore-item", itemId }));
				return outcome;
			},
			async restoreItem(itemId: string) {
				const outcome = await run(() => dispatch(restoreItem(itemId)));
				if (outcome?.status === "success") dispatch(showToast("Item restored"));
				return outcome;
			},
			async purgeItems(itemIds: string[]) {
				const outcome = await run(() => dispatch(purgeItems(itemIds)));
				if (outcome?.status === "success") dispatch(showToast(itemIds.length > 1 ? `${itemIds.length} items permanently deleted` : "Item permanently deleted"));
				return outcome;
			},
			setFavorite: (itemId: string, favorite: boolean) => run(() => dispatch(setFavorite({ itemId, favorite }))),
			moveItem: (itemId: string, folderId: string | null) => run(() => dispatch(moveItem({ itemId, folderId }))),
			createFolder: (name: string) => run(() => dispatch(createFolder(name))),
			renameFolder: (path: string, newPath: string) => run(() => dispatch(renameFolder({ path, newPath }))),
			deleteFolder: (folderId: string) => run(() => dispatch(deleteFolder(folderId))),
		};
	}, [dispatch, requestReprompt]);
}
