import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { store, useAppDispatch, useAppSelector } from "@store";
import { closeEditor, openEditor, resolveNavigation, selectItem, setEditorDirty } from "@modules/vault/vault.reducer";
import { selectModalOpen } from "@modules/ui/ui.reducer";
import { useVaultWrites } from "@hooks/useVaultWrites";
import { useHotkeys } from "@hooks/useHotkeys";
import { CipherType, type ItemDraft, type VaultItem, type WriteOutcome } from "@shared/types/vault.types";
import { draftErrors, isDraftDirty } from "@view/utils/draft.utils";
import { Kbd } from "@components/shared/Kbd";
import { EditorHeader, cipherTypeKeys } from "./EditorHeader";
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
	const { t } = useTranslation(["editor", "common"]);
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
										{t("form.discardChanges")}
									</Button>
									<Button color="warning" size="small" variant="outlined" disabled={saving} onClick={saveAgain}>
										{t("form.saveAgain")}
									</Button>
								</Box>
							}
						>
							{t("form.conflict")}
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

					<EditorSection title={t("form.notes")}>
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

			<Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 4, py: 1.25, borderTop: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)" }}>
				<Typography sx={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
					{item ? t("form.editing") : t("form.new")} · {t(`types.${cipherTypeKeys[type]}`)}
				</Typography>
				{/* Shortcut hints next to the buttons: inside a button's icon slot MUI would scale the keys up */}
				<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto", mr: 1, fontSize: "0.72rem", color: "var(--text-faint)" }}>
					<Kbd>Ctrl</Kbd>
					<Kbd>S</Kbd>
					<Box component="span" sx={{ mr: 1 }}>
						{t("form.saveHint")}
					</Box>
					<Kbd>Esc</Kbd>
					<span>{t("form.cancelHint")}</span>
				</Box>
				<Button size="small" color="inherit" onClick={() => dispatch(closeEditor())}>
					{t("common:cancel")}
				</Button>
				<Button size="small" variant="contained" disabled={saving} onClick={() => void save()}>
					{saving ? t("form.saving") : t("common:save")}
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
