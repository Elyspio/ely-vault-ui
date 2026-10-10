import { describe, expect, it } from "vite-plus/test";
import { canCheck, fromUpdateInfo, isDowngrade, isNoReleaseError, shortErrorMessage, updaterChannel } from "./update.status";

describe("canCheck", () => {
	it("allows a check when nothing is pending", () => {
		for (const state of ["idle", "up-to-date", "no-release", "available", "error"] as const) expect(canCheck(state)).toBe(true);
	});

	it("refuses a check while checking or once a download started", () => {
		for (const state of ["checking", "downloading", "downloaded"] as const) expect(canCheck(state)).toBe(false);
	});
});

describe("updaterChannel", () => {
	it("maps each channel to the electron-updater options", () => {
		expect(updaterChannel("stable")).toEqual({ channel: "latest", allowPrerelease: false });
		expect(updaterChannel("beta")).toEqual({ channel: "beta", allowPrerelease: true });
		expect(updaterChannel("dev")).toEqual({ channel: "dev", allowPrerelease: true });
	});
});

describe("isDowngrade", () => {
	it("compares the versions with semver", () => {
		expect(isDowngrade("1.3.0-beta.1", "1.2.0")).toBe(true);
		expect(isDowngrade("1.3.0-beta.1", "1.3.0")).toBe(false);
		expect(isDowngrade("1.3.0-dev.2", "1.3.0-beta.4")).toBe(true);
		expect(isDowngrade("1.2.0", "1.10.0")).toBe(false);
	});
});

describe("fromUpdateInfo", () => {
	it("keeps the HTML release notes, trimmed", () => {
		expect(fromUpdateInfo({ version: "1.2.0", releaseDate: "2026-10-01T10:00:00.000Z", releaseNotes: "  <p>Notes</p>\n" })).toEqual({
			latestVersion: "1.2.0",
			releaseDate: "2026-10-01T10:00:00.000Z",
			releaseNotes: "<p>Notes</p>",
		});
	});

	it("joins the notes of several versions", () => {
		const status = fromUpdateInfo({
			version: "1.2.0",
			releaseDate: "",
			releaseNotes: [
				{ version: "1.2.0", note: "<p>B</p>" },
				{ version: "1.1.0", note: null },
			],
		});
		expect(status.releaseNotes).toBe("<p>B</p>");
		expect(status.releaseDate).toBeNull();
	});

	it("maps missing notes to null", () => {
		expect(fromUpdateInfo({ version: "1.2.0", releaseDate: "2026-10-01", releaseNotes: null }).releaseNotes).toBeNull();
		expect(fromUpdateInfo({ version: "1.2.0", releaseDate: "2026-10-01", releaseNotes: "  " }).releaseNotes).toBeNull();
	});
});

describe("isNoReleaseError", () => {
	it("recognizes a channel without release", () => {
		expect(isNoReleaseError({ message: "No published versions on GitHub", code: "ERR_UPDATER_NO_PUBLISHED_VERSIONS" })).toBe(true);
		expect(
			isNoReleaseError({
				message:
					"Cannot parse releases feed: Error: Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists",
				code: "ERR_UPDATER_INVALID_RELEASE_FEED",
			})
		).toBe(true);
		expect(isNoReleaseError({ message: "net::ERR_INTERNET_DISCONNECTED" })).toBe(false);
	});
});

describe("shortErrorMessage", () => {
	it("keeps the first line, shortened", () => {
		expect(shortErrorMessage("Cannot download\nXML: <feed>")).toBe("Cannot download");
		expect(shortErrorMessage("x".repeat(300))).toHaveLength(200);
	});
});
