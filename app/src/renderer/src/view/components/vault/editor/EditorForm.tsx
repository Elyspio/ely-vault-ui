import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { store, useAppDispatch, useAppSelector } from "@store";
import { closeEditor, openEditor, resolveNavigation, selectItem, setEditorDirty } from "@modules/vault/vault.reducer";
import { selectModalOpen } from "@modules/ui/ui.reducer";
import { useVaultWrites } from "@hooks/useVaultWrites";
import { useHotkeys } from "@hooks/useHotkeys";
import { CipherType, type ItemDraft, type VaultItem, type WriteOutcome } from "@shared/types/vault.types";
import { draftErrors, isDraftDirty } from "@view/utils/draft.utils";
import { Kbd } from "@components/shared/Kbd";
import { EditorHeader } from "./EditorHeader";
import { LoginFields } from "./LoginFields";
import { CardFields } from "./CardFields";
import { IdentityFields } from "./IdentityFields";
import { SshKeySection } from "./SshKeySection";
import { CustomFields } from "./CustomFields";
import { EditorSection } from "./EditorSection";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

type Props = {
	/** Edited item, null in create mode */
	item: VaultItem | null;
	/** Draft the form starts from: the item as it is, or the new item with its defaults */
	initial: ItemDraft;
};

/**
 * The editing form: holds the draft in local state (secrets included, never in Redux), saves it, and handles
 * the conflict with a concurrent change and the unsaved changes question.
 */
export function EditorForm({ item, initial }: Readonly<Props>) {
	const dispatch = useAppDispatch();
	const writes = useVaultWrites();
	const pending = useAppSelector((state) => state.vault.pendingNavigation);
	const dialogOpen = useAppSelector(selectModalOpen);
	const [draft, setDraft] = useState<ItemDraft>(initial);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [conflict, setConflict] = useState(false);
	// Guards against a second save started before the first one re-rendered the buttons
	const savingRef = useRef(false);

	useEffect(() => {
		dispatch(setEditorDirty(isDraftDirty(initial, draft)));
	}, [dispatch, initial, draft]);

	const save = async () => {
		if (savingRef.current) return;
		const message = draftErrors(draft, item === null);
		if (message) {
			setError(message);
			return;
		}

		savingRef.current = true;
		setSaving(true);
		setError(null);
		setConflict(false);
		try {
			const outcome = item ? await writes.updateItem(item.id, currentRevision(item), draft) : await writes.createItem(draft);
			finish(outcome, item?.id ?? null);
		} finally {
			savingRef.current = false;
			setSaving(false);
		}
	};

	/**
	 * A success leaves the editor (or applies the navigation the user asked for); a failure keeps the form
	 */
	const finish = (outcome: WriteOutcome | null, itemId: string | null) => {
		const navigation = store.getState().vault.pendingNavigation;

		if (outcome?.status === "success") {
			dispatch(setEditorDirty(false));
			if (navigation) dispatch(resolveNavigation("saved"));
			else {
				dispatch(closeEditor());
				dispatch(selectItem(outcome.id ?? itemId));
			}
			return;
		}

		// The unsaved changes question is answered by staying in the editor
		if (navigation) dispatch(resolveNavigation("cancel"));
		if (outcome?.status === "conflict") setConflict(true);
	};

	/** Saves over the concurrent change: the editor reopens on the fresh revision, the draft is kept */
	const saveAgain = () => {
		if (!item) return;
		const fresh = store.getState().vault.snapshot?.items.find((candidate) => candidate.id === item.id);
		// Deleted in the meantime: the parent shows it
		if (!fresh) return;
		dispatch(openEditor({ mode: "edit", itemId: item.id, revision: fresh.revisionDate }));
		// Opening resets the dirty flag: restore it for the draft as it is
		dispatch(setEditorDirty(isDraftDirty(initial, draft)));
		void save();
	};

	const discard = () => {
		dispatch(setEditorDirty(false));
		dispatch(closeEditor());
	};

	// Disabled while the unsaved changes question or another dialog (palette, picker…) is open: their own keys win
	useHotkeys(
		[
			{ combo: "ctrl+s", handler: () => void save(), allowInInput: true },
			{ combo: "escape", handler: () => dispatch(closeEditor()), allowInInput: true },
		],
		pending === null && !dialogOpen
	);

	const type = draft.type;

	return (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--surface-0)" }}>
			<Box sx={{ flex: 1, overflow: "auto" }}>
				<Box sx={{ maxWidth: 720, mx: "auto", px: 4, py: 3.5, animation: "fadeIn 150ms ease" }}>
					{conflict && (
						<Alert
							severity="warning"
							sx={{ mb: 2 }}
							action={
								<Box sx={{ display: "flex", gap: 1 }}>
									<Button color="inherit" size="small" onClick={discard}>
										Discard my changes
									</Button>
									<Button color="warning" size="small" variant="outlined" disabled={saving} onClick={saveAgain}>
										Save again
									</Button>
								</Box>
							}
						>
							This item changed elsewhere since you opened it. Saving again overwrites those changes.
						</Alert>
					)}
					{error && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{error}
						</Alert>
					)}

					<EditorHeader draft={draft} setDraft={setDraft} item={item} />

					{type === CipherType.Login && <LoginFields draft={draft} setDraft={setDraft} item={item} />}
					{type === CipherType.Card && <CardFields draft={draft} setDraft={setDraft} item={item} />}
					{type === CipherType.Identity && <IdentityFields draft={draft} setDraft={setDraft} />}
					{type === CipherType.SshKey && <SshKeySection item={item} setDraft={setDraft} />}

					<EditorSection title="Notes">
						<TextField
							multiline
							minRows={3}
							fullWidth
							size="small"
							value={draft.notes ?? ""}
							onChange={(event) => setDraft((current: ItemDraft) => ({ ...current, notes: event.target.value }))}
						/>
					</EditorSection>

					<CustomFields draft={draft} setDraft={setDraft} item={item} />
				</Box>
			</Box>

			<Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1.5, px: 4, py: 1.5, borderTop: "1px solid var(--border-subtle)" }}>
				<Typography sx={{ mr: "auto", fontSize: "0.75rem", color: "var(--text-faint)" }}>{item ? "Editing" : "New item"}</Typography>
				<Button color="inherit" onClick={() => dispatch(closeEditor())} endIcon={<Kbd>Esc</Kbd>}>
					Cancel
				</Button>
				<Button variant="contained" disabled={saving} onClick={() => void save()} endIcon={<Kbd>Ctrl+S</Kbd>}>
					Save
				</Button>
			</Box>

			<UnsavedChangesDialog
				open={pending !== null}
				saving={saving}
				onSave={() => void save()}
				onDiscard={() => dispatch(resolveNavigation("discard"))}
				onCancel={() => dispatch(resolveNavigation("cancel"))}
			/>
		</Box>
	);
}

/** Revision the update is checked against: the one the editor opened (or last reopened) on */
function currentRevision(item: VaultItem): string {
	const editor = store.getState().vault.editor;
	return editor?.mode === "edit" ? editor.revision : item.revisionDate;
}
