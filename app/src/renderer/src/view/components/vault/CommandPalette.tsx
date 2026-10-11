import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Box, Dialog, InputBase, Typography } from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import PasswordRounded from "@mui/icons-material/PasswordRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import StarOutlineRounded from "@mui/icons-material/StarOutlineRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectActiveSelectedItem, selectItems } from "@modules/vault/vault.selectors";
import { getItemSubtitle, normalize, searchItems } from "@modules/vault/vault.search";
import { selectItem, setFilter, setQuery } from "@modules/vault/vault.reducer";
import { setGeneratorOpen, setPaletteOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { lock } from "@modules/session/session.async.actions";
import { syncVault } from "@modules/vault/vault.async.actions";
import { useVaultActions } from "@hooks/useVaultActions";
import { useItemCommands } from "@hooks/useItemCommands";
import type { VaultItem } from "@shared/types/vault.types";
import { ItemIcon } from "./ItemIcon";
import { Kbd } from "@components/shared/Kbd";
import { usePrimaryCopy } from "./usePrimaryCopy";
import { canAutoType } from "@hooks/useAutoType";

type Command = { id: string; label: string; icon: ReactNode; keywords: string; run: () => void };

type Entry = { kind: "item"; item: VaultItem } | { kind: "command"; command: Command };

const MAX_ITEMS = 8;

/**
 * Ctrl+K: search the whole vault and copy without leaving the keyboard
 */
export function CommandPalette() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.paletteOpen);
	const close = () => dispatch(setPaletteOpen(false));

	return (
		<Dialog
			open={open}
			onClose={close}
			maxWidth={false}
			slotProps={{
				paper: {
					sx: {
						width: 640,
						maxWidth: "calc(100vw - 48px)",
						alignSelf: "flex-start",
						mt: "12vh",
						bgcolor: "var(--surface-1)",
						border: "1px solid var(--border-medium)",
						boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
					},
				},
				backdrop: { sx: { backdropFilter: "blur(3px)", bgcolor: "rgba(0,0,0,0.45)" } },
			}}
		>
			{/* Mounted on each opening: the query starts empty */}
			{open && <PaletteContent close={close} />}
		</Dialog>
	);
}

function PaletteContent({ close }: Readonly<{ close: () => void }>) {
	const dispatch = useAppDispatch();
	const items = useAppSelector(selectItems);
	const actions = useVaultActions();
	const itemCommands = useItemCommands();
	const selected = useAppSelector(selectActiveSelectedItem);
	const editing = useAppSelector((state) => state.vault.editor !== null);
	const copyPrimary = usePrimaryCopy();
	const [query, setLocalQuery] = useState("");
	const [index, setIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	// Item actions need a selected active item, and wait while the editor is open (same rules as the hotkeys)
	const commands = useMemo<Command[]>(() => {
		const itemActions: Command[] =
			selected && !editing
				? [
						{ id: "edit-item", label: "Edit item", icon: <EditRounded />, keywords: "edit modify change item", run: () => void itemCommands.edit(selected) },
						{
							id: "favorite-item",
							label: selected.favorite ? "Remove from favorites" : "Add to favorites",
							icon: <StarOutlineRounded />,
							keywords: "favorite favourite star toggle",
							run: () => void itemCommands.toggleFavorite(selected),
						},
						{
							id: "delete-item",
							label: "Delete item",
							icon: <DeleteOutlineRounded />,
							keywords: "delete remove trash item",
							run: () => void itemCommands.remove(selected),
						},
					]
				: [];

		return [
			{ id: "new-item", label: "New item", icon: <AddRounded />, keywords: "new create add item login note card identity", run: () => itemCommands.newItem() },
			...itemActions,
			{ id: "lock", label: "Lock the vault", icon: <LockRounded />, keywords: "lock", run: () => dispatch(lock()) },
			{ id: "sync", label: "Sync", icon: <SyncRounded />, keywords: "synchroniser sync rafraichir", run: () => dispatch(syncVault()) },
			{
				id: "generate",
				label: "Generate a password",
				icon: <PasswordRounded />,
				keywords: "generate generator password",
				run: () => dispatch(setGeneratorOpen(true)),
			},
			{ id: "settings", label: "Settings", icon: <TuneRounded />, keywords: "settings preferences", run: () => dispatch(setSettingsOpen(true)) },
		];
	}, [dispatch, itemCommands, selected, editing]);

	const entries = useMemo<Entry[]>(() => {
		const matchingItems = query.trim() ? searchItems(items, { kind: "all" }, query).slice(0, MAX_ITEMS) : items.filter((i) => i.favorite).slice(0, MAX_ITEMS);
		const q = normalize(query.trim());
		const matchingCommands = q ? commands.filter((c) => normalize(`${c.label} ${c.keywords}`).includes(q)) : [];
		return [...matchingItems.map((item) => ({ kind: "item" as const, item })), ...matchingCommands.map((command) => ({ kind: "command" as const, command }))];
	}, [items, query, commands]);

	useEffect(() => {
		listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
	}, [index]);

	const activate = (entry: Entry | undefined, event: React.KeyboardEvent | React.MouseEvent) => {
		if (!entry) return;
		close();

		if (entry.kind === "command") {
			entry.command.run();
			return;
		}

		const { item } = entry;
		if (event.altKey) {
			dispatch(setFilter({ kind: "all" }));
			dispatch(setQuery(""));
			dispatch(selectItem(item.id));
		} else if (event.shiftKey) {
			if (item.login?.username) void actions.copy(item.id, { kind: "username" }, "Username");
		} else if (event.ctrlKey || event.metaKey) {
			if (item.login?.hasTotp) void actions.copy(item.id, { kind: "totp" }, "Code");
		} else {
			void copyPrimary(item);
		}
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setIndex((i) => Math.min(i + 1, entries.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setIndex((i) => Math.max(i - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			activate(entries[index], event);
		} else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
			// Ctrl+V stays a paste in the search field
			const entry = entries[index];
			if (entry?.kind === "item" && canAutoType(entry.item)) {
				event.preventDefault();
				close();
				void actions.autoType(entry.item.id);
			}
		}
	};

	return (
		<>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5, borderBottom: "1px solid var(--border-subtle)" }}>
				<SearchRounded sx={{ color: "var(--text-faint)" }} />
				<InputBase
					autoFocus
					fullWidth
					placeholder="Search an item or an action…"
					value={query}
					onChange={(event) => {
						setLocalQuery(event.target.value);
						setIndex(0);
					}}
					onKeyDown={onKeyDown}
					sx={{ fontSize: "1rem" }}
				/>
				<Kbd>Esc</Kbd>
			</Box>

			<Box ref={listRef} sx={{ maxHeight: 420, overflow: "auto", p: 0.75 }}>
				{!query.trim() && entries.length > 0 && (
					<Typography variant="overline" component="div" sx={{ px: 1.25, color: "var(--text-faint)" }}>
						Favorites
					</Typography>
				)}
				{entries.length === 0 && (
					<Typography sx={{ p: 3, textAlign: "center", color: "var(--text-faint)", fontSize: "0.85rem" }}>
						{query ? "No results" : "Type to search the whole vault"}
					</Typography>
				)}
				{entries.map((entry, i) => (
					<Box
						key={entry.kind === "item" ? entry.item.id : entry.command.id}
						data-index={i}
						onMouseMove={() => setIndex(i)}
						onClick={(event) => activate(entry, event)}
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							px: 1.25,
							py: 0.9,
							borderRadius: 2,
							cursor: "pointer",
							bgcolor: i === index ? "var(--surface-3)" : "transparent",
						}}
					>
						{entry.kind === "item" ? (
							<>
								<ItemIcon item={entry.item} size={30} />
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 500 }}>
										{entry.item.name}
									</Typography>
									<Typography noWrap sx={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
										{getItemSubtitle(entry.item)}
									</Typography>
								</Box>
								{i === index && <Hint item={entry.item} />}
							</>
						) : (
							<>
								<Box sx={{ width: 30, height: 30, display: "grid", placeItems: "center", color: "var(--text-muted)", "& .MuiSvgIcon-root": { fontSize: 18 } }}>
									{entry.command.icon}
								</Box>
								<Typography sx={{ flex: 1, fontSize: "0.88rem" }}>{entry.command.label}</Typography>
								{i === index && <Typography sx={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>Action</Typography>}
							</>
						)}
					</Box>
				))}
			</Box>

			<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", px: 2, py: 1, borderTop: "1px solid var(--border-subtle)", bgcolor: "var(--surface-0)" }}>
				<Shortcut keys={["↵"]} label="Copy" />
				<Shortcut keys={["Shift", "↵"]} label="Username" />
				<Shortcut keys={["Ctrl", "↵"]} label="Code TOTP" />
				<Shortcut keys={["Alt", "↵"]} label="Show" />
				<Shortcut keys={["Ctrl", "Shift", "V"]} label="Auto-type" />
			</Box>
		</>
	);
}

function Hint({ item }: Readonly<{ item: VaultItem }>) {
	const label = item.login?.hasPassword ? "Copy password" : item.card?.hasNumber ? "Copy number" : item.notes ? "Copy note" : "Copy";
	return <Typography sx={{ fontSize: "0.72rem", color: "primary.main", whiteSpace: "nowrap" }}>{label} ↵</Typography>;
}

function Shortcut({ keys, label }: Readonly<{ keys: string[]; label: string }>) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
			{keys.map((key) => (
				<Kbd key={key}>{key}</Kbd>
			))}
			<Typography sx={{ fontSize: "0.72rem", color: "var(--text-faint)", ml: 0.25 }}>{label}</Typography>
		</Box>
	);
}
