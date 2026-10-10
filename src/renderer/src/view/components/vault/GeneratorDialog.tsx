import { useCallback, useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Slider, Tooltip, Typography } from "@mui/material";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setGeneratorOpen, showToast } from "@modules/ui/ui.reducer";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";
import { useVaultActions } from "@hooks/useVaultActions";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { ColoredSecret } from "./fields/SecretRow";

/**
 * Password generator of the Bitwarden CLI (upper/lower case, digits, symbols)
 */
export function GeneratorDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.generatorOpen);
	const actions = useVaultActions();
	const [length, setLength] = useState(24);
	const [password, setPassword] = useState("");

	const generate = useCallback(
		async (size: number) => {
			try {
				setPassword(await webContainer.get(VaultService).generatePassword(size));
			} catch (error) {
				dispatch(showToast(ipcErrorMessage(error), "error"));
			}
		},
		[dispatch]
	);

	useEffect(() => {
		if (open) void generate(length);
		else setPassword("");
		// Only when opening: the slider regenerates on its own
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const close = () => dispatch(setGeneratorOpen(false));

	return (
		<Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
			<DialogTitle>Générateur de mot de passe</DialogTitle>
			<DialogContent>
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
					<Tooltip title="Regénérer">
						<IconButton onClick={() => void generate(length)}>
							<RefreshRounded />
						</IconButton>
					</Tooltip>
				</Box>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2.5 }}>
					<Typography sx={{ fontSize: "0.85rem", color: "text.secondary", whiteSpace: "nowrap" }}>Longueur : {length}</Typography>
					<Slider value={length} min={8} max={64} onChange={(_, value) => setLength(value)} onChangeCommitted={(_, value) => void generate(value)} />
				</Box>
				<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
					<Button color="inherit" onClick={close}>
						Fermer
					</Button>
					<Button
						variant="contained"
						startIcon={<ContentCopyRounded />}
						disabled={!password}
						onClick={() => {
							void actions.copy(null, { kind: "text", value: password }, "Mot de passe");
							close();
						}}
					>
						Copier
					</Button>
				</Box>
			</DialogContent>
		</Dialog>
	);
}
