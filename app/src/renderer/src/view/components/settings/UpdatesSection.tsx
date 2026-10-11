import { Box, Button, LinearProgress, Link, Typography } from "@mui/material";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAppDispatch, useAppSelector } from "@store";
import { checkForUpdate, downloadUpdate, installUpdate } from "@modules/update/update.async.actions";
import type { UpdateStatus } from "@shared/types/update.types";
import { formatRelative } from "@view/utils/date.utils";
import { ReleaseNotes } from "./ReleaseNotes";

type T = TFunction<"settings">;

const rowSx = { display: "flex", alignItems: "center", gap: 2, px: 2, py: 1.5, "&:not(:last-child)": { borderBottom: "1px solid var(--border-subtle)" } };

/**
 * Installed version, state of the automatic update and the action it waits for
 */
export function UpdatesSection() {
	const { t } = useTranslation("settings");
	const dispatch = useAppDispatch();
	const status = useAppSelector((state) => state.update.status);

	if (!status) return null;

	const showNotes = status.releaseNotes && (status.state === "available" || status.state === "downloading" || status.state === "downloaded");

	return (
		<>
			<Box sx={rowSx}>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{title(status, t)}</Typography>
					<Typography sx={{ fontSize: "0.75rem", color: status.state === "error" ? "error.main" : "var(--text-muted)", overflowWrap: "anywhere" }}>
						{description(status, t)}
					</Typography>
				</Box>
				<Action
					status={status}
					t={t}
					onCheck={() => dispatch(checkForUpdate())}
					onDownload={() => dispatch(downloadUpdate())}
					onInstall={() => dispatch(installUpdate())}
				/>
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
						{t("releaseNotes.title", { version: status.latestVersion })}
					</Typography>
					<ReleaseNotes html={status.releaseNotes!} />
				</Box>
			)}

			<Box sx={{ ...rowSx, py: 1 }}>
				<Typography sx={{ flex: 1, fontSize: "0.72rem", color: "var(--text-faint)" }}>
					{status.isPackaged ? lastCheck(status, t) : t("updates.developmentBuild")}
				</Typography>
				<Link
					component="button"
					underline="hover"
					sx={{ fontSize: "0.75rem" }}
					onClick={() => void window.preload.ipc.send.app.openExternal(window.preload.config.releasesUrl)}
				>
					{t("updates.allReleases")}
				</Link>
			</Box>
		</>
	);
}

function Action({ status, t, onCheck, onDownload, onInstall }: Readonly<{ status: UpdateStatus; t: T; onCheck: () => void; onDownload: () => void; onInstall: () => void }>) {
	switch (status.state) {
		case "available":
			if (status.downgrade) {
				return (
					<Button size="small" variant="contained" onClick={onDownload}>
						{t("updates.action.downgrade", { version: status.latestVersion })}
					</Button>
				);
			}
			// Development builds do not download automatically
			return status.isPackaged ? null : (
				<Button size="small" variant="outlined" onClick={onDownload}>
					{t("updates.action.download")}
				</Button>
			);
		case "downloading":
			return null;
		case "downloaded":
			return (
				<Button size="small" variant="contained" startIcon={<RestartAltRounded />} disabled={!status.isPackaged} onClick={onInstall}>
					{t("updates.action.install")}
				</Button>
			);
		default:
			return (
				<Button size="small" variant="outlined" disabled={status.state === "checking"} onClick={onCheck}>
					{status.state === "checking" ? t("updates.action.checking") : t("updates.action.check")}
				</Button>
			);
	}
}

function title(status: UpdateStatus, t: T) {
	const version = status.latestVersion;
	switch (status.state) {
		case "checking":
			return t("updates.title.checking");
		case "up-to-date":
			return t("updates.title.upToDate");
		case "no-release":
			return t("updates.title.noRelease");
		case "available":
			return status.downgrade ? t("updates.title.olderAvailable", { version }) : t("updates.title.found", { version });
		case "downloading":
			return t("updates.title.downloading", { version });
		case "downloaded":
			return t("updates.title.downloaded", { version });
		case "error":
			return t("updates.title.error");
		default:
			return t("updates.title.current", { version: status.currentVersion });
	}
}

function description(status: UpdateStatus, t: T) {
	switch (status.state) {
		case "available":
			if (status.downgrade) return t("updates.description.downgrade", { version: status.currentVersion });
			return status.isPackaged ? t("updates.description.downloadStarting") : t("updates.description.manualDownload");
		case "downloaded":
			return status.downgrade ? t("updates.description.installedOnRestart") : t("updates.description.installedOnRestartOrQuit");
		case "error":
			return status.error ?? "";
		default:
			return t("updates.description.installedVersion", { version: status.currentVersion });
	}
}

function lastCheck(status: UpdateStatus, t: T) {
	const last = status.lastCheckAt ? t("updates.lastCheck", { when: formatRelative(status.lastCheckAt) }) : t("updates.notChecked");
	return status.nextCheckAt ? t("updates.nextCheck", { last, when: formatRelative(status.nextCheckAt) }) : last;
}
