import { describe, expect, it } from "vite-plus/test";
import { allowsDowngrade, canCheck, fromUpdateInfo, isDowngrade } from "./update.status";

describe("canCheck", () => {
	it("allows a check when nothing is pending", () => {
		for (const state of ["idle", "up-to-date", "available", "error"] as const) expect(canCheck(state)).toBe(true);
	});

	it("refuses a check while checking or once a download started", () => {
		for (const state of ["checking", "downloading", "downloaded"] as const) expect(canCheck(state)).toBe(false);
	});
});

describe("allowsDowngrade", () => {
	it("only for a beta build without the beta channel", () => {
		expect(allowsDowngrade("1.3.0-beta.1", false)).toBe(true);
		expect(allowsDowngrade("1.3.0-beta.1", true)).toBe(false);
		expect(allowsDowngrade("1.3.0", false)).toBe(false);
		expect(allowsDowngrade("1.3.0", true)).toBe(false);
	});
});

describe("isDowngrade", () => {
	it("compares the versions with semver", () => {
		expect(isDowngrade("1.3.0-beta.1", "1.2.0")).toBe(true);
		expect(isDowngrade("1.3.0-beta.1", "1.3.0")).toBe(false);
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
