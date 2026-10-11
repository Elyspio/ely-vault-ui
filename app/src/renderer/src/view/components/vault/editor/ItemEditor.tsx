import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { store, useAppDispatch, useAppSelector } from "@store";
import { closeEditor, setEditorDirty } from "@modules/vault/vault.reducer";
import { showToast } from "@modules/ui/ui.reducer";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { CipherType, type ItemDraft, type VaultItem } from "@shared/types/vault.types";
import { emptyDraft, itemToDraft } from "@view/utils/draft.utils";
import { EditorForm } from "./EditorForm";

/**
 * Inline editor of the detail panel: replaces the item detail while `state.vault.editor` is set.
 * Edit mode starts from the item in the snapshot, create mode from empty sections with the defaults of the current view.
 */
export function ItemEditor() {
	const editor = useAppSelector((state) => state.vault.editor);
	if (!editor) return null;

	return editor.mode === "edit" ? <EditItem key={`edit:${editor.itemId}`} itemId={editor.itemId} /> : <CreateItem key={`create:${editor.type}`} type={editor.type} />;
}

function EditItem({ itemId }: Readonly<{ itemId: string }>) {
	const item = useAppSelector((state) => state.vault.snapshot?.items.find((candidate) => candidate.id === itemId) ?? null);
	if (!item) return <DeletedItem />;
	return <EditItemForm item={item} />;
}

/** Local draft starts from the item the editor opened: later snapshots do not reset the user's changes */
function EditItemForm({ item }: Readonly<{ item: VaultItem }>) {
	const [initial] = useState<ItemDraft>(() => itemToDraft(item));
	return <EditorForm item={item} initial={initial} />;
}

/**
 * Create mode: the defaults come from the current view (folder, favorites) and a login gets a generated password
 */
function CreateItem({ type }: Readonly<{ type: CipherType }>) {
	const dispatch = useAppDispatch();
	const [initial, setInitial] = useState<ItemDraft | null>(null);

	useEffect(() => {
		let active = true;
		const { filter } = store.getState().vault;
		const defaults = { folderId: filter.kind === "folder" ? filter.id : null, favorite: filter.kind === "favorites" };

		async function build() {
			let password: string | undefined;
			if (type === CipherType.Login) {
				try {
					password = await webContainer.get(VaultService).generatePassword(store.getState().ui.generatorOptions);
				} catch (error) {
					dispatch(showToast(ipcErrorMessage(error), "error"));
				}
			}
			if (active) setInitial(emptyDraft(type, { ...defaults, password }));
		}

		void build();
		return () => {
			active = false;
		};
	}, [type, dispatch]);

	if (!initial) {
		return (
			<Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "var(--surface-0)" }}>
				<CircularProgress size={24} />
			</Box>
		);
	}

	return <EditorForm item={null} initial={initial} />;
}

/** The item was removed (deleted elsewhere or purged): the editor can only be closed */
function DeletedItem() {
	const dispatch = useAppDispatch();

	// Whatever the user typed cannot be saved anymore: no unsaved changes question
	useEffect(() => {
		dispatch(setEditorDirty(false));
	}, [dispatch]);

	return (
		<Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ textAlign: "center" }}>
				<Typography sx={{ color: "var(--text-muted)", mb: 2 }}>This item was deleted elsewhere</Typography>
				<Button variant="outlined" onClick={() => dispatch(closeEditor())}>
					Close
				</Button>
			</Box>
		</Box>
	);
}
