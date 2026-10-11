import { useState, type KeyboardEvent } from "react";
import { IconButton, InputAdornment, TextField, Tooltip } from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import ClearRounded from "@mui/icons-material/ClearRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import { useTranslation } from "react-i18next";
import { store, useAppDispatch } from "@store";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import type { SecretChange } from "@shared/types/vault.types";
import { toSecretChange } from "@view/utils/draft.utils";

type Props = {
	label: string;
	/** Change of the secret in the draft: undefined means unchanged */
	value: SecretChange | undefined;
	onChange: (change: SecretChange | undefined) => void;
	/** Edit mode: the item already holds a value (shown as "unchanged") */
	stored: boolean;
	/** Reveals the current value of the item; absent in create mode and for TOTP (no reveal exists) */
	reveal?: () => Promise<string | null>;
	/** Shows the Generate button; Ctrl+G fills the field too */
	generate?: boolean;
	error?: string | null;
	helperText?: string;
	autoFocus?: boolean;
};

/**
 * Write-only secret input. In edit mode the value stays unchanged until the user types, clears or reveals it
 * (the reveal goes through the main process, with the master password reprompt when the item asks for it).
 * The text is local component state: it never reaches the store.
 */
export function SecretInput({ label, value, onChange, stored, reveal, generate, error, helperText, autoFocus }: Readonly<Props>) {
	const { t } = useTranslation(["editor", "common"]);
	const dispatch = useAppDispatch();
	// Unchanged value shown for display only: the draft keeps it unchanged until the user edits the input
	const [revealed, setRevealed] = useState<string | null>(null);
	const [shown, setShown] = useState(false);
	const [generating, setGenerating] = useState(false);

	const unchanged = value === undefined;
	const cleared = value?.kind === "clear";
	const text = value?.kind === "set" ? value.value : cleared ? "" : (revealed ?? "");
	const hasValue = value?.kind === "set" || (stored && !cleared);

	const toggleShown = async () => {
		if (!unchanged || revealed !== null || !reveal) {
			setShown((current) => !current);
			return;
		}
		const current = await reveal();
		// null: reprompt cancelled or error (already reported)
		if (current === null) return;
		setRevealed(current);
		setShown(true);
	};

	const undo = () => {
		setRevealed(null);
		onChange(undefined);
	};

	const generatePassword = async () => {
		setGenerating(true);
		try {
			const password = await webContainer.get(VaultService).generatePassword(store.getState().ui.generatorOptions);
			onChange({ kind: "set", value: password });
			setShown(true);
		} catch (error) {
			dispatch(showToast(ipcErrorMessage(error), "error"));
		} finally {
			setGenerating(false);
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!generate || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "g") return;
		// Stops the window listener of the global shortcut (it would open the generator dialog)
		event.preventDefault();
		event.stopPropagation();
		void generatePassword();
	};

	let placeholder: string | undefined;
	if (cleared) placeholder = t("secret.removedOnSave");
	else if (unchanged && stored && revealed === null) placeholder = t("secret.unchanged");

	return (
		<TextField
			label={label}
			fullWidth
			size="small"
			autoFocus={autoFocus}
			autoComplete="new-password"
			type={shown ? "text" : "password"}
			value={text}
			placeholder={placeholder}
			error={Boolean(error)}
			helperText={error ?? helperText}
			onKeyDown={onKeyDown}
			onChange={(event) => {
				// Typing in an unchanged value starts from the revealed text: the input becomes a set value
				setRevealed(null);
				onChange(toSecretChange(event.target.value));
			}}
			slotProps={{
				// The placeholder tells "unchanged" / "removed": the label must stay above it
				inputLabel: placeholder ? { shrink: true } : undefined,
				input: {
					className: "mono",
					endAdornment: (
						<InputAdornment position="end" sx={{ gap: 0.25 }}>
							{hasValue && (reveal || value?.kind === "set") && (
								<Tooltip title={shown ? t("common:hide") : t("common:show")}>
									<IconButton size="small" onClick={() => void toggleShown()}>
										{shown ? <VisibilityOffRounded sx={{ fontSize: 16 }} /> : <VisibilityRounded sx={{ fontSize: 16 }} />}
									</IconButton>
								</Tooltip>
							)}
							{generate && (
								<Tooltip title={t("secret.generate")}>
									<span>
										<IconButton size="small" disabled={generating} onClick={() => void generatePassword()}>
											<AutorenewRounded sx={{ fontSize: 16 }} />
										</IconButton>
									</span>
								</Tooltip>
							)}
							{stored && !unchanged && (
								<Tooltip title={t("secret.undo")}>
									<IconButton size="small" onClick={undo}>
										<UndoRounded sx={{ fontSize: 16 }} />
									</IconButton>
								</Tooltip>
							)}
							{hasValue && !cleared && (
								<Tooltip title={t("secret.remove")}>
									<IconButton size="small" onClick={() => onChange({ kind: "clear" })}>
										<ClearRounded sx={{ fontSize: 16 }} />
									</IconButton>
								</Tooltip>
							)}
						</InputAdornment>
					),
				},
			}}
		/>
	);
}
