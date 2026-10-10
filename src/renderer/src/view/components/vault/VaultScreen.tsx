import { useRef } from "react";
import { Box } from "@mui/material";
import { useAppDispatch, useAppSelector, store } from "@store";
import { lock } from "@modules/session/session.async.actions";
import { syncVault } from "@modules/vault/vault.async.actions";
import { selectSelectedItem } from "@modules/vault/vault.selectors";
import { setGeneratorOpen, setPaletteOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { useHotkeys } from "@hooks/useHotkeys";
import { useVaultActions } from "@hooks/useVaultActions";
import { canAutoType } from "@hooks/useAutoType";
import { Sidebar } from "./Sidebar";
import { ItemList } from "./ItemList";
import { ItemDetail } from "./ItemDetail";
import { CommandPalette } from "./CommandPalette";
import { GeneratorDialog } from "./GeneratorDialog";
import { SettingsDialog } from "@components/settings/SettingsDialog";

export function VaultScreen() {
	const dispatch = useAppDispatch();
	const actions = useVaultActions();
	const searchRef = useRef<HTMLInputElement>(null);
	const dialogOpen = useAppSelector((state) => state.ui.paletteOpen || state.ui.settingsOpen || state.ui.generatorOpen);

	const selected = () => selectSelectedItem(store.getState());

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
					if (item?.login?.hasPassword) void actions.copy(item.id, { kind: "password" }, "Mot de passe");
				},
				allowInInput: true,
			},
			{
				combo: "ctrl+shift+u",
				handler: () => {
					const item = selected();
					if (item?.login?.username) void actions.copy(item.id, { kind: "username" }, "Identifiant");
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
		],
		!dialogOpen
	);

	return (
		<Box sx={{ height: "100%", display: "grid", gridTemplateColumns: "236px minmax(300px, 380px) minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr)" }}>
			<Sidebar />
			<ItemList searchRef={searchRef} />
			<ItemDetail />
			<CommandPalette />
			<GeneratorDialog />
			<SettingsDialog />
		</Box>
	);
}
