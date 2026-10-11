import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useAppDispatch, useAppSelector, store } from "@store";
import { lock } from "@modules/session/session.async.actions";
import { syncVault } from "@modules/vault/vault.async.actions";
import { selectActiveSelectedItem } from "@modules/vault/vault.selectors";
import { selectModalOpen, setGeneratorOpen, setPaletteOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { useHotkeys } from "@hooks/useHotkeys";
import { useVaultActions } from "@hooks/useVaultActions";
import { useItemCommands } from "@hooks/useItemCommands";
import { canAutoType } from "@hooks/useAutoType";
import { Sidebar } from "./Sidebar";
import { ItemList } from "./ItemList";
import { ItemDetail } from "./ItemDetail";
import { CommandPalette } from "./CommandPalette";
import { GeneratorDialog } from "./GeneratorDialog";
import { NewItemDialog } from "./NewItemDialog";
import { SettingsDialog } from "@components/settings/SettingsDialog";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { saveConfig } from "@modules/config/config.async.actions";
import { clampPanelLayout, defaultAppConfig, type PanelLayout } from "@shared/config/app.config";

export function VaultScreen() {
	const dispatch = useAppDispatch();
	const actions = useVaultActions();
	const searchRef = useRef<HTMLInputElement>(null);
	const screenRef = useRef<HTMLDivElement>(null);
	const config = useAppSelector((state) => state.config.current);
	// Widths being dragged, saved to the configuration once the drag is over
	const [draft, setDraft] = useState<PanelLayout | null>(null);
	const [screenWidth, setScreenWidth] = useState<number>();
	// The saved widths give way to the item detail when the window is narrower than when they were set
	const layout = clampPanelLayout(draft ?? config.layout, "listWidth", screenWidth);

	useEffect(() => {
		const screen = screenRef.current;
		if (!screen) return;
		const observer = new ResizeObserver(() => setScreenWidth(screen.clientWidth));
		observer.observe(screen);
		return () => observer.disconnect();
	}, []);
	const dialogOpen = useAppSelector(selectModalOpen);
	const editing = useAppSelector((state) => state.vault.editor !== null);
	const itemCommands = useItemCommands();

	// Active items only: the hotkeys copy and type secrets, which a deleted item must never do
	const selected = () => selectActiveSelectedItem(store.getState());

	// Window shortcuts that work with the editor open too (Ctrl+G stays with the editor fields)
	useHotkeys(
		[
			{ combo: "ctrl+k", handler: () => dispatch(setPaletteOpen(true)), allowInInput: true },
			{ combo: "ctrl+p", handler: () => dispatch(setPaletteOpen(true)), allowInInput: true },
			{
				combo: "ctrl+f",
				handler: () => {
					searchRef.current?.focus();
					searchRef.current?.select();
				},
				allowInInput: true,
			},
			{ combo: "ctrl+l", handler: () => dispatch(lock()), allowInInput: true },
			{ combo: "f5", handler: () => dispatch(syncVault()), allowInInput: true },
			{ combo: "ctrl+r", handler: () => dispatch(syncVault()), allowInInput: true },
			{ combo: "ctrl+g", handler: () => dispatch(setGeneratorOpen(true)), allowInInput: true },
			{ combo: "ctrl+,", handler: () => dispatch(setSettingsOpen(true)), allowInInput: true },
			{ combo: "ctrl+n", handler: () => itemCommands.newItem(), allowInInput: true },
		],
		!dialogOpen
	);

	// Item shortcuts: they act on the selected item, so they wait while the editor is open
	useHotkeys(
		[
			{
				// Like KeePass: Ctrl+V on the selected row types it into the previous window; a text field keeps the normal paste
				combo: "ctrl+v",
				handler: () => {
					const item = selected();
					if (item && canAutoType(item)) void actions.autoType(item.id);
				},
			},
			{
				combo: "ctrl+shift+c",
				handler: () => {
					const item = selected();
					if (item?.login?.hasPassword) void actions.copy(item.id, { kind: "password" }, "Password");
				},
				allowInInput: true,
			},
			{
				combo: "ctrl+shift+u",
				handler: () => {
					const item = selected();
					if (item?.login?.username) void actions.copy(item.id, { kind: "username" }, "Username");
				},
				allowInInput: true,
			},
			{
				combo: "ctrl+shift+o",
				handler: () => {
					const item = selected();
					if (item?.login?.hasTotp) void actions.copy(item.id, { kind: "totp" }, "Code");
				},
				allowInInput: true,
			},
			// Not in a text field: the keys keep their meaning there (Delete, F2 and Ctrl+E/D are text editing or search keys)
			{
				combo: "ctrl+e",
				handler: () => {
					const item = selected();
					if (item) void itemCommands.edit(item);
				},
			},
			{
				combo: "f2",
				handler: () => {
					const item = selected();
					if (item) void itemCommands.edit(item);
				},
			},
			{
				// The trash has no Delete shortcut: its selection is not an active item
				combo: "delete",
				handler: () => {
					const item = selected();
					if (item) void itemCommands.remove(item);
				},
			},
			{
				combo: "ctrl+d",
				handler: () => {
					const item = selected();
					if (item) void itemCommands.toggleFavorite(item);
				},
			},
		],
		!dialogOpen && !editing
	);

	const resize = (panel: keyof PanelLayout) => (width: number, done: boolean) => {
		const next = clampPanelLayout({ ...layout, [panel]: width }, panel, screenWidth);
		if (done) commit(next);
		else setDraft(next);
	};

	const commit = (next: PanelLayout) => {
		setDraft(null);
		if (next.sidebarWidth !== config.layout.sidebarWidth || next.listWidth !== config.layout.listWidth) void dispatch(saveConfig({ ...config, layout: next }));
	};

	const reset = (panel: keyof PanelLayout) => () => commit(clampPanelLayout({ ...layout, [panel]: defaultAppConfig.layout[panel] }, panel, screenWidth));

	return (
		<Box
			ref={screenRef}
			sx={{
				height: "100%",
				position: "relative",
				display: "grid",
				gridTemplateColumns: `${layout.sidebarWidth}px ${layout.listWidth}px minmax(0, 1fr)`,
				gridTemplateRows: "minmax(0, 1fr)",
				// Keeps the resize cursor and avoids selecting text while dragging
				...(draft && { cursor: "col-resize", userSelect: "none" }),
			}}
		>
			<Sidebar />
			<ItemList searchRef={searchRef} />
			<ItemDetail />
			<PanelResizeHandle
				label="Resize the sidebar"
				left={layout.sidebarWidth}
				width={layout.sidebarWidth}
				onResize={resize("sidebarWidth")}
				onReset={reset("sidebarWidth")}
			/>
			<PanelResizeHandle
				label="Resize the item list"
				left={layout.sidebarWidth + layout.listWidth}
				width={layout.listWidth}
				onResize={resize("listWidth")}
				onReset={reset("listWidth")}
			/>
			<CommandPalette />
			<NewItemDialog />
			<GeneratorDialog />
			<SettingsDialog />
		</Box>
	);
}
