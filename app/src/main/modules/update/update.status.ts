import semver from "semver";
import type { UpdateInfo } from "electron-updater";
import type { UpdateChannel } from "@shared/config/app.config";
import type { UpdateState, UpdateStatus } from "@shared/types/update.types";

/**
 * A check must not replace a check in progress, nor a download in progress or ready to install
 */
export function canCheck(state: UpdateState): boolean {
	return state !== "checking" && state !== "downloading" && state !== "downloaded";
}

/**
 * electron-updater options of a channel (GitHub provider):
 * - stable: the latest release, prereleases ignored;
 * - beta: the newest stable or beta release, the development builds (custom "dev" channel) are skipped;
 * - dev: the newest development build only.
 */
export function updaterChannel(channel: UpdateChannel): { channel: "latest" | "beta" | "dev"; allowPrerelease: boolean } {
	switch (channel) {
		case "stable":
			return { channel: "latest", allowPrerelease: false };
		case "beta":
			return { channel: "beta", allowPrerelease: true };
		case "dev":
			return { channel: "dev", allowPrerelease: true };
	}
}

export function isDowngrade(currentVersion: string, latestVersion: string) {
	return semver.lt(latestVersion, currentVersion);
}

export function fromUpdateInfo(info: Pick<UpdateInfo, "version" | "releaseDate" | "releaseNotes">): Pick<UpdateStatus, "latestVersion" | "releaseDate" | "releaseNotes"> {
	const notes = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((note) => note.note ?? "").join("\n") : info.releaseNotes;
	return {
		latestVersion: info.version,
		releaseDate: info.releaseDate || null,
		releaseNotes: notes?.trim() || null,
	};
}
