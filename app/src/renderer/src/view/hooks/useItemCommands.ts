import { useContext, useMemo } from "react";
import { store, useAppDispatch } from "@store";
import { setMoveItemId, setNewItemOpen, showToast } from "@modules/ui/ui.reducer";
import { openEditor, selectItem } from "@modules/vault/vault.reducer";
import { selectVisibleItems } from "@modules/vault/vault.selectors";
import { neighbourId } from "@modules/vault/vault.search";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { RepromptContext } from "./useVaultActions";
import { useVaultWrites } from "./useVaultWrites";
import { i18n } from "@/config/i18n";

/** Types the editor knows (Login, SecureNote, Card, Identity, SshKey): other types are never edited */
export function isEditableItem(item: VaultItem): boolean {
	return !item.deletedDate && item.type >= CipherType.Login && item.type <= CipherType.SshKey;
}

/**
 * Commands on the items, shared by the detail panel, the hotkeys and the command palette.
 * Item commands are refused while the editor is open: they act on the item the detail panel shows.
 */
export function useItemCommands() {
	const dispatch = useAppDispatch();
	const requestReprompt = useContext(RepromptContext);
	const writes = useVaultWrites();

	return useMemo(() => {
		const editorOpen = () => store.getState().vault.editor !== null;

		return {
			/** Opens the type picker; refused while the editor has unsaved changes (they would be lost) */
			newItem() {
				if (store.getState().vault.editorDirty) {
					dispatch(showToast(i18n.t("actions:items.saveOrCancelFirst"), "info"));
					return;
				}
				dispatch(setNewItemOpen(true));
			},

			/** Opens the item in the editor, after the master password when the item asks for it */
			async edit(item: VaultItem) {
				if (editorOpen() || !isEditableItem(item)) return;
				if (item.reprompt && !(await requestReprompt())) return;
				if (editorOpen()) return;
				dispatch(openEditor({ mode: "edit", itemId: item.id, revision: item.revisionDate }));
			},

			/** Moves to the trash; the selection goes to the neighbour in the visible list */
			async remove(item: VaultItem) {
				if (editorOpen() || item.deletedDate) return;
				const next = neighbourId(selectVisibleItems(store.getState()), item.id);
				const outcome = await writes.deleteItem(item.id, item.name);
				if (outcome?.status === "success") dispatch(selectItem(next));
			},

			async toggleFavorite(item: VaultItem) {
				if (editorOpen() || item.deletedDate) return;
				await writes.setFavorite(item.id, !item.favorite);
			},

			/** Opens the folder picker of the item (the dialog writes the choice) */
			move(item: VaultItem) {
				if (editorOpen() || item.deletedDate) return;
				dispatch(setMoveItemId(item.id));
			},
		};
	}, [dispatch, requestReprompt, writes]);
}
