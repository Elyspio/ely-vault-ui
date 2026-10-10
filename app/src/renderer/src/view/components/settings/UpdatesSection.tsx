import { Box, Button, LinearProgress, Link, Typography } from "@mui/material";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { checkForUpdate, downloadUpdate, installUpdate } from "@modules/update/update.async.actions";
import type { UpdateStatus } from "@shared/types/update.types";
import { formatRelative } from "@view/utils/date.utils";
import { ReleaseNotes } from "./ReleaseNotes";

const rowSx = { display: "flex", alignItems: "center", gap: 2, px: 2, py: 1.5, borderBottom: "1px solid var(--border-subtle)" };

/**
 * Installed version, state of the automatic update and the action it waits for
 */
export function UpdatesSection() {
	const dispatch = useAppDispatch();
	const status = useAppSelector((state) => state.update.status);

	if (!status) return null;

	const showNotes = status.releaseNotes && (status.state === "available" || status.state === "downloading" || status.state === "downloaded");

	return (
		<>
			<Box sx={rowSx}>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{title(status)}</Typography>
					<Typography sx={{ fontSize: "0.75rem", color: status.state === "error" ? "error.main" : "var(--text-muted)", overflowWrap: "anywhere" }}>
						{description(status)}
					</Typography>
				</Box>
				<Action status={status} onCheck={() => dispatch(checkForUpdate())} onDownload={() => dispatch(downloadUpdate())} onInstall={() => dispatch(installUpdate())} />
			</Box>

			{status.state === "downloading" && (
				<Box sx={{ ...rowSx, py: 1 }}>
					<LinearProgress variant="determinate" value={status.progress ?? 0} sx={{ flex: 1, borderRadius: 1 }} />
					<Typography className="mono" sx={{ fontSize: "0.72rem", color: "var(--text-muted)", width: 40, textAlign: "right" }}>
						{Math.round(status.progress ?? 0)} %
					</Typography>
				</Box>
			)}

			{showNotes && (
				<Box sx={{ ...rowSx, display: "block" }}>
					<Typography variant="overline" component="div" sx={{ color: "var(--text-faint)", lineHeight: 1.6 }}>
						Notes de version · {status.latestVersion}
					</Typography>
					<ReleaseNotes html={status.releaseNotes!} />
				</Box>
			)}

			<Box sx={{ ...rowSx, py: 1 }}>
				<Typography sx={{ flex: 1, fontSize: "0.72rem", color: "var(--text-faint)" }}>
					{status.isPackaged ? lastCheck(status) : "Version de développement : vérification via dev-app-update.yml, aucune installation"}
				</Typography>
				<Link
					component="button"
					underline="hover"
					sx={{ fontSize: "0.75rem" }}
					onClick={() => void window.preload.ipc.send.app.openExternal(window.preload.config.releasesUrl)}
				>
					Toutes les versions
				</Link>
			</Box>
		</>
	);
}

function Action({ status, onCheck, onDownload, onInstall }: Readonly<{ status: UpdateStatus; onCheck: () => void; onDownload: () => void; onInstall: () => void }>) {
	switch (status.state) {
		case "available":
			if (status.downgrade) {
				return (
					<Button size="small" variant="contained" onClick={onDownload}>
						Revenir à la {status.latestVersion}
					</Button>
				);
			}
			// Development builds do not download automatically
			return status.isPackaged ? null : (
				<Button size="small" variant="outlined" onClick={onDownload}>
					Télécharger
				</Button>
			);
		case "downloading":
			return null;
		case "downloaded":
			return (
				<Button size="small" variant="contained" startIcon={<RestartAltRounded />} disabled={!status.isPackaged} onClick={onInstall}>
					Redémarrer et installer
				</Button>
			);
		default:
			return (
				<Button size="small" variant="outlined" disabled={status.state === "checking"} onClick={onCheck}>
					{status.state === "checking" ? "Vérification…" : "Vérifier"}
				</Button>
			);
	}
}

function title(status: UpdateStatus) {
	switch (status.state) {
		case "checking":
			return "Recherche d'une mise à jour…";
		case "up-to-date":
			return "Vault est à jour";
		case "available":
			return status.downgrade ? `Version stable ${status.latestVersion} disponible` : `Version ${status.latestVersion} trouvée`;
		case "downloading":
			return `Téléchargement de la version ${status.latestVersion}`;
		case "downloaded":
			return `Version ${status.latestVersion} prête à installer`;
		case "error":
			return "La mise à jour a échoué";
		default:
			return `Version ${status.currentVersion}`;
	}
}

function description(status: UpdateStatus) {
	switch (status.state) {
		case "available":
			if (status.downgrade) return `Plus ancienne que la bêta installée (${status.currentVersion}) : installée seulement à votre demande`;
			return status.isPackaged ? "Le téléchargement va commencer" : "Version de développement : téléchargement manuel";
		case "downloaded":
			return status.downgrade ? "Installée au redémarrage de Vault" : "Installée au redémarrage ou à la fermeture de Vault";
		case "error":
			return status.error ?? "";
		default:
			return `Version installée : ${status.currentVersion}`;
	}
}

function lastCheck(status: UpdateStatus) {
	const last = status.lastCheckAt ? `Dernière vérification ${formatRelative(status.lastCheckAt)}` : "Aucune vérification depuis le démarrage";
	return status.nextCheckAt ? `${last} · prochaine ${formatRelative(status.nextCheckAt)}` : last;
}
