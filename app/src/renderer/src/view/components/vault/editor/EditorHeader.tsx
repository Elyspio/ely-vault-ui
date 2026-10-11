import type { Dispatch, SetStateAction } from "react";
import { Box, Chip, FormControlLabel, IconButton, MenuItem, Switch, TextField, Tooltip } from "@mui/material";
import StarRounded from "@mui/icons-material/StarRounded";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import { useAppSelector } from "@store";
import { CipherType, type ItemDraft, type VaultItem } from "@shared/types/vault.types";
import { ItemIcon } from "../ItemIcon";

export const cipherTypeLabels: Record<CipherType, string> = {
	[CipherType.Login]: "Login",
	[CipherType.SecureNote]: "Secure note",
	[CipherType.Card]: "Card",
	[CipherType.Identity]: "Identity",
	[CipherType.SshKey]: "SSH key",
};

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
	/** Edited item, null in create mode */
	item: VaultItem | null;
};

/**
 * Name, favorite, folder and master password reprompt of the item
 */
export function EditorHeader({ draft, setDraft, item }: Readonly<Props>) {
	const folders = useAppSelector((state) => state.vault.snapshot?.folders ?? []);
	const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }));
	const folderMissing = draft.folderId !== null && !folders.some((folder) => folder.id === draft.folderId);

	return (
		<Box sx={{ mb: 3 }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
				{item && <ItemIcon item={item} size={52} />}
				<TextField
					autoFocus={!item}
					required
					label="Name"
					fullWidth
					value={draft.name}
					onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
					sx={{ flex: 1 }}
				/>
				<Tooltip title={draft.favorite ? "Remove from favorites" : "Add to favorites"}>
					<IconButton onClick={() => setDraft((current) => ({ ...current, favorite: !current.favorite }))} aria-label="Favorite">
						{draft.favorite ? <StarRounded sx={{ color: "warning.main" }} /> : <StarBorderRounded />}
					</IconButton>
				</Tooltip>
			</Box>

			<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
				<TextField
					select
					size="small"
					label="Folder"
					value={draft.folderId ?? ""}
					onChange={(event) => setDraft((current) => ({ ...current, folderId: event.target.value || null }))}
					sx={{ minWidth: 220 }}
				>
					<MenuItem value="">No folder</MenuItem>
					{folderMissing && <MenuItem value={draft.folderId ?? ""}>Unknown folder</MenuItem>}
					{sortedFolders.map((folder) => (
						<MenuItem key={folder.id} value={folder.id}>
							{folder.name}
						</MenuItem>
					))}
				</TextField>
				<FormControlLabel
					control={<Switch checked={draft.reprompt} onChange={(_, reprompt) => setDraft((current) => ({ ...current, reprompt }))} />}
					label="Ask for the master password"
				/>
				<Chip size="small" variant="outlined" label={cipherTypeLabels[draft.type]} sx={{ borderColor: "var(--border-subtle)" }} />
			</Box>
		</Box>
	);
}
