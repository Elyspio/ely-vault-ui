import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Box, Button, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import PasswordRounded from "@mui/icons-material/PasswordRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import CropSquareRounded from "@mui/icons-material/CropSquareRounded";
import FilterNoneRounded from "@mui/icons-material/FilterNoneRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { store, useAppDispatch, useAppSelector } from "@store";
import { lock } from "@modules/session/session.async.actions";
import { syncVault } from "@modules/vault/vault.async.actions";
import { closeEditor } from "@modules/vault/vault.reducer";
import { setGeneratorOpen, setPaletteOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { Kbd } from "@components/shared/Kbd";
import { Logo } from "@components/shared/Logo";
import { formatRelative } from "@view/utils/date.utils";
import { selectPendingUpdate } from "@modules/update/update.selectors";
import { downloadUpdate, installUpdate } from "@modules/update/update.async.actions";

const noDrag = { WebkitAppRegion: "no-drag" } as const;

const controlSx = { width: 30, height: 28, borderRadius: 1.5, color: "var(--text-muted)", "&:hover": { color: "text.primary" }, ...noDrag };

export function Titlebar() {
	const dispatch = useAppDispatch();
	const { t } = useTranslation("auth");
	const unlocked = useAppSelector((state) => state.session.current?.status === "unlocked");
	const syncing = useAppSelector((state) => state.vault.syncing);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync ?? null);
	const pendingUpdate = useAppSelector(selectPendingUpdate);
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		void window.preload.ipc.send.app.screen.isFullScreen().then(setMaximized);
		return window.preload.ipc.on.app.screen.toggleFullScreen(setMaximized);
	}, []);

	/** With unsaved changes, closing asks first: the unsaved changes dialog opens and the window stays open */
	const closeWindow = () => {
		if (store.getState().vault.editorDirty) dispatch(closeEditor());
		else void window.preload.ipc.send.app.close();
	};

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
						{t("titlebar.search")}
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
						<Tooltip title={t("titlebar.generator")}>
							<IconButton sx={controlSx} onClick={() => dispatch(setGeneratorOpen(true))}>
								<PasswordRounded sx={{ fontSize: 17 }} />
							</IconButton>
						</Tooltip>
						<Tooltip title={lastSync ? t("titlebar.syncWithLast", { lastSync: formatRelative(lastSync) }) : t("titlebar.sync")}>
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
						<Tooltip title={t("titlebar.lock")}>
							<IconButton sx={controlSx} onClick={() => dispatch(lock())}>
								<LockRounded sx={{ fontSize: 16 }} />
							</IconButton>
						</Tooltip>
					</>
				)}
				{/* Locked or logged out: the update waiting for the user is offered here too */}
				{!unlocked && pendingUpdate && (
					<>
						<Tooltip
							title={
								pendingUpdate.downgrade && pendingUpdate.state === "available"
									? t("titlebar.olderThanInstalled", { version: pendingUpdate.currentVersion })
									: t("titlebar.restarts")
							}
						>
							<Box component="span" sx={noDrag}>
								<Button
									size="small"
									variant="outlined"
									startIcon={<RestartAltRounded sx={{ fontSize: 16 }} />}
									disabled={pendingUpdate.state === "downloaded" && !pendingUpdate.isPackaged}
									onClick={() => dispatch(pendingUpdate.state === "downloaded" ? installUpdate() : downloadUpdate())}
									sx={{ height: 26, fontSize: "0.75rem", py: 0 }}
								>
									{pendingUpdate.state === "downloaded"
										? t("titlebar.updateTo", { version: pendingUpdate.latestVersion })
										: t("titlebar.goBackTo", { version: pendingUpdate.latestVersion })}
								</Button>
							</Box>
						</Tooltip>
						<Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1 }} />
					</>
				)}
				<Tooltip
					title={
						pendingUpdate
							? pendingUpdate.downgrade && pendingUpdate.state === "available"
								? t("titlebar.olderVersionAvailable", { version: pendingUpdate.latestVersion })
								: t("titlebar.versionReady", { version: pendingUpdate.latestVersion })
							: t("titlebar.settings")
					}
				>
					<IconButton sx={controlSx} onClick={() => dispatch(setSettingsOpen(true))}>
						<Badge variant="dot" color="primary" invisible={!pendingUpdate}>
							<TuneRounded sx={{ fontSize: 17 }} />
						</Badge>
					</IconButton>
				</Tooltip>
				<Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1 }} />
				<IconButton sx={controlSx} onClick={() => window.preload.ipc.send.app.screen.minimize()}>
					<RemoveRounded sx={{ fontSize: 16 }} />
				</IconButton>
				<IconButton sx={controlSx} onClick={() => window.preload.ipc.send.app.screen.toggleFullScreen()}>
					{maximized ? <FilterNoneRounded sx={{ fontSize: 13 }} /> : <CropSquareRounded sx={{ fontSize: 15 }} />}
				</IconButton>
				<IconButton sx={{ ...controlSx, "&:hover": { color: "#fff", bgcolor: "#e81123" } }} onClick={closeWindow}>
					<CloseRounded sx={{ fontSize: 16 }} />
				</IconButton>
			</Box>
		</Box>
	);
}
