import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, Slider, Switch, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setGeneratorOpen, setGeneratorOptions, showToast } from "@modules/ui/ui.reducer";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { useVaultActions } from "@hooks/useVaultActions";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import type { PasswordGeneratorMode, PasswordGeneratorOptions } from "@shared/types/vault.types";
import { ColoredSecret } from "./fields/SecretRow";
import { useDialogFocus } from "@hooks/useDialogFocus";

const modeLabels: Record<PasswordGeneratorMode, string> = {
	password: "Password",
	hex: "Hexadecimal",
	base64: "Base64",
};

/**
 * Password generator: Bitwarden CLI (upper/lower case, digits, optional symbols) or random bytes in hex / base64
 */
export function GeneratorDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.generatorOpen);
	const actions = useVaultActions();
	/** Saved in the store: the item editor generates with the same options */
	const options = useAppSelector((state) => state.ui.generatorOptions);
	const [password, setPassword] = useState("");
	// Copy is the main action: focused on opening, once the password is generated (the button is disabled before)
	const copyRef = useRef<HTMLButtonElement>(null);
	const focus = useDialogFocus(() => copyRef.current, !!password);

	const generate = useCallback(
		async (next: PasswordGeneratorOptions) => {
			try {
				setPassword(await webContainer.get(VaultService).generatePassword(next));
			} catch (error) {
				dispatch(showToast(ipcErrorMessage(error), "error"));
			}
		},
		[dispatch]
	);

	useEffect(() => {
		if (open) void generate(options);
		else setPassword("");
		// Only when opening: option changes regenerate on their own
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const close = () => dispatch(setGeneratorOpen(false));

	const update = (changes: Partial<PasswordGeneratorOptions>) => {
		const next = { ...options, ...changes };
		dispatch(setGeneratorOptions(next));
		void generate(next);
	};

	return (
		<Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ transition: focus }}>
			<DialogTitle>Password generator</DialogTitle>
			<DialogContent>
				<ToggleButtonGroup
					exclusive
					fullWidth
					size="small"
					value={options.mode}
					onChange={(_, mode: PasswordGeneratorMode | null) => mode && update({ mode })}
					sx={{ mb: 2 }}
				>
					{Object.entries(modeLabels).map(([mode, label]) => (
						<ToggleButton key={mode} value={mode}>
							{label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
				<Box
					className="mono"
					sx={{
						minHeight: 64,
						display: "flex",
						alignItems: "center",
						px: 2,
						py: 1.5,
						borderRadius: 2,
						bgcolor: "var(--surface-0)",
						border: "1px solid var(--border-subtle)",
						fontSize: "1.05rem",
						overflowWrap: "anywhere",
					}}
				>
					<Box sx={{ flex: 1 }}>{password && <ColoredSecret value={password} />}</Box>
					<Tooltip title="Regenerate">
						<IconButton onClick={() => void generate(options)}>
							<RefreshRounded />
						</IconButton>
					</Tooltip>
				</Box>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2.5 }}>
					<Typography sx={{ fontSize: "0.85rem", color: "text.secondary", whiteSpace: "nowrap" }}>Longueur : {options.length}</Typography>
					<Slider
						value={options.length}
						min={8}
						max={64}
						onChange={(_, length) => dispatch(setGeneratorOptions({ ...options, length }))}
						onChangeCommitted={(_, length) => update({ length })}
					/>
				</Box>
				<FormControlLabel
					sx={{ mt: 1 }}
					disabled={options.mode !== "password"}
					control={<Switch checked={options.special} onChange={(_, special) => update({ special })} />}
					label={<Typography sx={{ fontSize: "0.85rem" }}>Special characters (!@#$%^&amp;*)</Typography>}
				/>
				<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
					<Button color="inherit" onClick={close}>
						Close
					</Button>
					<Button
						ref={copyRef}
						variant="contained"
						startIcon={<ContentCopyRounded />}
						disabled={!password}
						onClick={() => {
							void actions.copy(null, { kind: "text", value: password }, "Password");
							close();
						}}
					>
						Copy
					</Button>
				</Box>
			</DialogContent>
		</Dialog>
	);
}
