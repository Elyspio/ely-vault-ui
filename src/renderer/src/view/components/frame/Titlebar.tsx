import { useEffect, useState } from "react";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import PasswordRounded from "@mui/icons-material/PasswordRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import CropSquareRounded from "@mui/icons-material/CropSquareRounded";
import FilterNoneRounded from "@mui/icons-material/FilterNoneRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { lock } from "@modules/session/session.async.actions";
import { syncVault } from "@modules/vault/vault.async.actions";
import { setGeneratorOpen, setPaletteOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { Kbd } from "@components/shared/Kbd";
import { Logo } from "@components/shared/Logo";
import { formatRelative } from "@view/utils/date.utils";

const noDrag = { WebkitAppRegion: "no-drag" } as const;

const controlSx = { width: 30, height: 28, borderRadius: 1.5, color: "var(--text-muted)", "&:hover": { color: "text.primary" }, ...noDrag };

export function Titlebar() {
	const dispatch = useAppDispatch();
	const unlocked = useAppSelector((state) => state.session.current?.status === "unlocked");
	const syncing = useAppSelector((state) => state.vault.syncing);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync ?? null);
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		void window.preload.ipc.send.app.screen.isFullScreen().then(setMaximized);
		return window.preload.ipc.on.app.screen.toggleFullScreen(setMaximized);
	}, []);

	return (
		<Box
			sx={{
				height: "var(--titlebar-height)",
				display: "grid",
				gridTemplateColumns: "1fr auto 1fr",
				alignItems: "center",
				px: 1.25,
				borderBottom: "1px solid var(--border-subtle)",
				bgcolor: "var(--surface-0)",
				WebkitAppRegion: "drag",
				userSelect: "none",
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
				<Logo size={18} />
				<Typography sx={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.02em", color: "var(--text-muted)" }}>{window.preload.config.appName}</Typography>
			</Box>

			{unlocked ? (
				<Box
					component="button"
					onClick={() => dispatch(setPaletteOpen(true))}
					sx={{
						...noDrag,
						width: 380,
						height: 26,
						display: "flex",
						alignItems: "center",
						gap: 1,
						px: 1.25,
						border: "1px solid var(--border-subtle)",
						borderRadius: 1.5,
						bgcolor: "var(--surface-1)",
						color: "var(--text-faint)",
						font: "inherit",
						fontSize: "0.78rem",
						cursor: "pointer",
						transition: "border-color 120ms ease, color 120ms ease",
						"&:hover": { borderColor: "var(--border-medium)", color: "var(--text-muted)" },
					}}
				>
					<SearchRounded sx={{ fontSize: 15 }} />
					<Box component="span" sx={{ flex: 1, textAlign: "left" }}>
						Rechercher et copier…
					</Box>
					<Kbd>Ctrl</Kbd>
					<Kbd>K</Kbd>
				</Box>
			) : (
				<span />
			)}

			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.25 }}>
				{unlocked && (
					<>
						<Tooltip title="Générateur de mot de passe (Ctrl G)">
							<IconButton sx={controlSx} onClick={() => dispatch(setGeneratorOpen(true))}>
								<PasswordRounded sx={{ fontSize: 17 }} />
							</IconButton>
						</Tooltip>
						<Tooltip title={`Synchroniser (F5)${lastSync ? ` · ${formatRelative(lastSync)}` : ""}`}>
							<IconButton sx={controlSx} onClick={() => dispatch(syncVault())} disabled={syncing}>
								<SyncRounded
									sx={{
										fontSize: 17,
										animation: syncing ? "spin 900ms linear infinite" : undefined,
										"@keyframes spin": { to: { transform: "rotate(-360deg)" } },
									}}
								/>
							</IconButton>
						</Tooltip>
						<Tooltip title="Verrouiller (Ctrl L)">
							<IconButton sx={controlSx} onClick={() => dispatch(lock())}>
								<LockRounded sx={{ fontSize: 16 }} />
							</IconButton>
						</Tooltip>
						<Tooltip title="Paramètres (Ctrl ,)">
							<IconButton sx={controlSx} onClick={() => dispatch(setSettingsOpen(true))}>
								<TuneRounded sx={{ fontSize: 17 }} />
							</IconButton>
						</Tooltip>
						<Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1 }} />
					</>
				)}
				<IconButton sx={controlSx} onClick={() => window.preload.ipc.send.app.screen.minimize()}>
					<RemoveRounded sx={{ fontSize: 16 }} />
				</IconButton>
				<IconButton sx={controlSx} onClick={() => window.preload.ipc.send.app.screen.toggleFullScreen()}>
					{maximized ? <FilterNoneRounded sx={{ fontSize: 13 }} /> : <CropSquareRounded sx={{ fontSize: 15 }} />}
				</IconButton>
				<IconButton sx={{ ...controlSx, "&:hover": { color: "#fff", bgcolor: "#e81123" } }} onClick={() => window.preload.ipc.send.app.close()}>
					<CloseRounded sx={{ fontSize: 16 }} />
				</IconButton>
			</Box>
		</Box>
	);
}
