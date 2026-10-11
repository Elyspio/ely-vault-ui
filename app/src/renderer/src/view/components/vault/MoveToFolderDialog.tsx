import { useEffect, useMemo, useState } from "react";
import { Box, Dialog, DialogContent, DialogTitle, InputBase, Typography } from "@mui/material";
import FolderRounded from "@mui/icons-material/FolderRounded";
import FolderOffRounded from "@mui/icons-material/FolderOffRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectItems } from "@modules/vault/vault.selectors";
import { setMoveItemId, showToast } from "@modules/ui/ui.reducer";
import { moveChoices, type FolderChoice } from "@modules/vault/vault.folders";
import { useVaultWrites } from "@hooks/useVaultWrites";
import type { VaultItem } from "@shared/types/vault.types";

/**
 * Folder picker opened by Ctrl+M: type to filter, arrows and Enter pick the folder, Escape closes it (Dialog).
 */
export function MoveToFolderDialog() {
	const dispatch = useAppDispatch();
	const itemId = useAppSelector((state) => state.ui.moveItemId);
	const item = useAppSelector((state) => (itemId ? (selectItems(state).find((candidate) => candidate.id === itemId) ?? null) : null));
	const close = () => dispatch(setMoveItemId(null));

	// The item left the active items while the dialog was open: nothing is left to move
	useEffect(() => {
		if (itemId && !item) dispatch(setMoveItemId(null));
	}, [itemId, item, dispatch]);

	return (
		<Dialog open={item !== null} onClose={close} maxWidth="xs" fullWidth>
			{/* Mounted on each opening: the filter starts empty */}
			{item && <FolderPicker item={item} close={close} />}
		</Dialog>
	);
}

function FolderPicker({ item, close }: Readonly<{ item: VaultItem; close: () => void }>) {
	const dispatch = useAppDispatch();
	const folders = useAppSelector((state) => state.vault.snapshot?.folders ?? []);
	const writes = useVaultWrites();
	const [query, setQuery] = useState("");
	const [index, setIndex] = useState(0);
	const [busy, setBusy] = useState(false);
	const choices = useMemo(() => moveChoices(folders, query), [folders, query]);

	const pick = async (choice: FolderChoice | undefined) => {
		if (!choice || busy) return;
		if (choice.id === item.folderId) return close();

		setBusy(true);
		const outcome = await writes.moveItem(item.id, choice.id);
		setBusy(false);
		// Errors are already reported by the write hook; the dialog stays open to pick another folder
		if (outcome?.status === "success") {
			dispatch(showToast(`Moved to ${choice.path}`));
			close();
		}
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setIndex((current) => Math.min(current + 1, choices.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setIndex((current) => Math.max(current - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			void pick(choices[Math.min(index, choices.length - 1)]);
		}
	};

	return (
		<>
			<DialogTitle sx={{ pb: 0.5 }}>Move to a folder</DialogTitle>
			<Typography noWrap sx={{ px: 3, pb: 1.5, fontSize: "0.78rem", color: "var(--text-muted)" }}>
				{item.name}
			</Typography>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mx: 2, mb: 1, px: 1.25, borderRadius: 2, bgcolor: "var(--surface-2)" }}>
				<SearchRounded sx={{ color: "var(--text-faint)", fontSize: 18 }} />
				<InputBase
					autoFocus
					fullWidth
					placeholder="Filter folders…"
					value={query}
					inputProps={{ "aria-label": "Filter folders" }}
					onChange={(event) => {
						setQuery(event.target.value);
						setIndex(0);
					}}
					onKeyDown={onKeyDown}
					sx={{ py: 0.75, fontSize: "0.88rem" }}
				/>
			</Box>
			<DialogContent sx={{ p: 1, pt: 0.5, maxHeight: 360 }}>
				{choices.map((choice, i) => (
					<Box
						key={choice.id ?? "none"}
						component="button"
						type="button"
						disabled={busy}
						onMouseMove={() => setIndex(i)}
						onClick={() => void pick(choice)}
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							px: 1.5,
							py: 0.9,
							borderRadius: 2,
							cursor: "pointer",
							width: "100%",
							border: "none",
							font: "inherit",
							color: "inherit",
							textAlign: "left",
							bgcolor: i === index ? "var(--surface-3)" : "transparent",
						}}
					>
						<Box sx={{ width: 26, height: 26, display: "grid", placeItems: "center", color: "var(--text-muted)", "& .MuiSvgIcon-root": { fontSize: 17 } }}>
							{choice.id === null ? <FolderOffRounded /> : <FolderRounded />}
						</Box>
						<Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: choice.id === item.folderId ? 600 : 500 }}>
							{choice.path}
						</Typography>
						{choice.id === item.folderId && (
							<Typography component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem", color: "primary.main" }}>
								<CheckRounded sx={{ fontSize: 15 }} />
								Current
							</Typography>
						)}
					</Box>
				))}
				{choices.length === 0 && (
					<Typography sx={{ p: 2, textAlign: "center", fontSize: "0.82rem", color: "var(--text-faint)" }}>No folder matches "{query.trim()}"</Typography>
				)}
			</DialogContent>
		</>
	);
}
