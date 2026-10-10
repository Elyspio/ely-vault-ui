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

/**
 * GitHub has no release for the channel: no stable release yet (`/releases/latest` answers 406) or no build of the prerelease channel
 */
export function isNoReleaseError(error: { message: string; code?: string }) {
	return error.code === "ERR_UPDATER_NO_PUBLISHED_VERSIONS" || /Unable to find latest version on GitHub|No published versions on GitHub/.test(error.message);
}

/**
 * First line of an updater error, shortened: the full message (with the release feed) only goes to the logs
 */
export function shortErrorMessage(message: string, max = 200) {
	const line = message.split("\n")[0].trim();
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
