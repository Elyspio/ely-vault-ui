import semver from "semver";
import type { UpdateInfo } from "electron-updater";
import type { UpdateState, UpdateStatus } from "@shared/types/update.types";

/**
 * A check must not replace a check in progress, nor a download in progress or ready to install
 */
export function canCheck(state: UpdateState): boolean {
	return state !== "checking" && state !== "downloading" && state !== "downloaded";
}

/**
 * A beta build without the beta channel goes back to the latest stable release, even when it is older
 */
export function allowsDowngrade(currentVersion: string, beta: boolean) {
	return !beta && semver.prerelease(currentVersion) !== null;
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
