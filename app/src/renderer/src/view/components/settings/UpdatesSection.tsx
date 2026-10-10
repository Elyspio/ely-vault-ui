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
						Release notes · {status.latestVersion}
					</Typography>
					<ReleaseNotes html={status.releaseNotes!} />
				</Box>
			)}

			<Box sx={{ ...rowSx, py: 1 }}>
				<Typography sx={{ flex: 1, fontSize: "0.72rem", color: "var(--text-faint)" }}>
					{status.isPackaged ? lastCheck(status) : "Development build: checks through dev-app-update.yml, nothing is installed"}
				</Typography>
				<Link
					component="button"
					underline="hover"
					sx={{ fontSize: "0.75rem" }}
					onClick={() => void window.preload.ipc.send.app.openExternal(window.preload.config.releasesUrl)}
				>
					All releases
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
						Go back to {status.latestVersion}
					</Button>
				);
			}
			// Development builds do not download automatically
			return status.isPackaged ? null : (
				<Button size="small" variant="outlined" onClick={onDownload}>
					Download
				</Button>
			);
		case "downloading":
			return null;
		case "downloaded":
			return (
				<Button size="small" variant="contained" startIcon={<RestartAltRounded />} disabled={!status.isPackaged} onClick={onInstall}>
					Restart and install
				</Button>
			);
		default:
			return (
				<Button size="small" variant="outlined" disabled={status.state === "checking"} onClick={onCheck}>
					{status.state === "checking" ? "Checking…" : "Check"}
				</Button>
			);
	}
}

function title(status: UpdateStatus) {
	switch (status.state) {
		case "checking":
			return "Checking for updates…";
		case "up-to-date":
			return "Vault is up to date";
		case "available":
			return status.downgrade ? `Stable version ${status.latestVersion} available` : `Version ${status.latestVersion} found`;
		case "downloading":
			return `Downloading version ${status.latestVersion}`;
		case "downloaded":
			return `Version ${status.latestVersion} ready to install`;
		case "error":
			return "The update failed";
		default:
			return `Version ${status.currentVersion}`;
	}
}

function description(status: UpdateStatus) {
	switch (status.state) {
		case "available":
			if (status.downgrade) return `Older than the installed beta (${status.currentVersion}): only installed on your request`;
			return status.isPackaged ? "The download is starting" : "Development build: manual download";
		case "downloaded":
			return status.downgrade ? "Installed when Vault restarts" : "Installed when Vault restarts or quits";
		case "error":
			return status.error ?? "";
		default:
			return `Installed version: ${status.currentVersion}`;
	}
}

function lastCheck(status: UpdateStatus) {
	const last = status.lastCheckAt ? `Last checked ${formatRelative(status.lastCheckAt)}` : "Not checked since startup";
	return status.nextCheckAt ? `${last} · next check ${formatRelative(status.nextCheckAt)}` : last;
}
