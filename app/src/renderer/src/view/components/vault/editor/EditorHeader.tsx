import type { Dispatch, SetStateAction } from "react";
import { Box, Chip, IconButton, InputBase, MenuItem, Switch, TextField, Tooltip, Typography } from "@mui/material";
import StarRounded from "@mui/icons-material/StarRounded";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
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
 * Name, favorite, folder and master password reprompt of the item, laid out like the header of the item detail
 */
export function EditorHeader({ draft, setDraft, item }: Readonly<Props>) {
	const folders = useAppSelector((state) => state.vault.snapshot?.folders ?? []);
	const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }));
	const folderMissing = draft.folderId !== null && !folders.some((folder) => folder.id === draft.folderId);

	return (
		<Box sx={{ mb: 3.5 }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
				<ItemIcon item={item ?? iconItem(draft)} size={52} />
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<InputBase
						autoFocus={!item}
						fullWidth
						required
						placeholder={`${cipherTypeLabels[draft.type]} name`}
						value={draft.name}
						onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
						inputProps={{ "aria-label": "Name" }}
						sx={{
							fontSize: "1.25rem",
							fontWeight: 600,
							letterSpacing: "-0.01em",
							borderBottom: "1px solid transparent",
							transition: "border-color 120ms ease",
							"&:hover": { borderColor: "var(--border-medium)" },
							"&.Mui-focused": { borderColor: "primary.main" },
							"& input": { py: 0.25 },
						}}
					/>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
						<TextField
							select
							size="small"
							value={draft.folderId ?? ""}
							onChange={(event) => setDraft((current) => ({ ...current, folderId: event.target.value || null }))}
							slotProps={{
								htmlInput: { "aria-label": "Folder" },
								select: {
									displayEmpty: true,
									renderValue: (value) => (
										<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
											<FolderRounded sx={{ fontSize: 15, color: "var(--text-muted)" }} />
											{value ? (folders.find((folder) => folder.id === value)?.name ?? "Unknown folder") : "No folder"}
										</Box>
									),
								},
							}}
							sx={{ minWidth: 170, "& .MuiInputBase-root": { fontSize: "0.8rem", height: 30 } }}
						>
							<MenuItem value="">No folder</MenuItem>
							{folderMissing && <MenuItem value={draft.folderId ?? ""}>Unknown folder</MenuItem>}
							{sortedFolders.map((folder) => (
								<MenuItem key={folder.id} value={folder.id}>
									{folder.name}
								</MenuItem>
							))}
						</TextField>
						<Chip size="small" variant="outlined" label={cipherTypeLabels[draft.type]} sx={{ borderColor: "var(--border-subtle)" }} />
						<Box component="label" sx={{ display: "inline-flex", alignItems: "center", cursor: "pointer", ml: 0.5 }}>
							<Switch size="small" checked={draft.reprompt} onChange={(_, reprompt) => setDraft((current) => ({ ...current, reprompt }))} />
							<Typography sx={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ask for the master password</Typography>
						</Box>
					</Box>
				</Box>
				<Tooltip title={draft.favorite ? "Remove from favorites" : "Add to favorites"}>
					<IconButton
						size="small"
						aria-label="Favorite"
						aria-pressed={draft.favorite}
						onClick={() => setDraft((current) => ({ ...current, favorite: !current.favorite }))}
						sx={{ alignSelf: "flex-start", color: draft.favorite ? "warning.main" : "var(--text-muted)" }}
					>
						{draft.favorite ? <StarRounded /> : <StarBorderRounded />}
					</IconButton>
				</Tooltip>
			</Box>
		</Box>
	);
}

/**
 * Icon of a new item: its type, or the initial of its name (no favicon request while typing)
 */
function iconItem(draft: ItemDraft): VaultItem {
	return { type: draft.type, name: draft.name.trim() || cipherTypeLabels[draft.type] } as VaultItem;
}
