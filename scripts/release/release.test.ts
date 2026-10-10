import { describe, expect, it } from "vite-plus/test";
import { parseReleaseVersion, releaseAssets, releaseProblems, type RepositoryState } from "./release";

const cleanMain: RepositoryState = { branch: "main", dirty: false, upToDate: true, tags: ["v0.1.0", "v0.2.0-beta.1"] };

describe("parseReleaseVersion", () => {
	it("accepts a stable version", () => {
		expect(parseReleaseVersion("1.2.0")).toEqual({ version: "1.2.0", tag: "v1.2.0", prerelease: false });
	});

	it("accepts a beta version as a prerelease", () => {
		expect(parseReleaseVersion("1.2.0-beta.3")).toEqual({ version: "1.2.0-beta.3", tag: "v1.2.0-beta.3", prerelease: true });
	});

	it("refuses invalid versions and other channels", () => {
		for (const version of ["1.2", "v1.2.0x", "1.2.0-rc.1", "1.2.0-alpha.1", "1.2.0-beta", "1.2.0-beta.1.2", "1.2.0+build.1"]) {
			expect(() => parseReleaseVersion(version), version).toThrow();
		}
	});
});

describe("releaseProblems", () => {
	it("accepts a new version from an up to date main", () => {
		expect(releaseProblems(parseReleaseVersion("0.2.0"), cleanMain)).toEqual([]);
	});

	it("reports every problem of the repository", () => {
		const problems = releaseProblems(parseReleaseVersion("0.1.0"), { branch: "feat/x", dirty: true, upToDate: false, tags: ["v0.1.0"] });
		expect(problems).toHaveLength(5);
	});

	it("refuses a version lower than the latest tag, betas included", () => {
		expect(releaseProblems(parseReleaseVersion("0.2.0-beta.1"), { ...cleanMain, tags: ["v0.1.0", "v0.2.0-beta.2"] })).toEqual([
			"Version 0.2.0-beta.1 must be greater than the latest tag v0.2.0-beta.2",
		]);
		expect(releaseProblems(parseReleaseVersion("0.2.0-beta.3"), { ...cleanMain, tags: ["v0.1.0", "v0.2.0-beta.2"] })).toEqual([]);
	});

	it("ignores tags that are not versions", () => {
		expect(releaseProblems(parseReleaseVersion("0.2.0"), { ...cleanMain, tags: ["vnext", "v0.1.0"] })).toEqual([]);
	});
});

describe("releaseAssets", () => {
	it("lists the installers and the update files", () => {
		expect(releaseAssets("vault-desktop", parseReleaseVersion("1.2.0"))).toEqual([
			"vault-desktop-1.2.0-setup.exe",
			"vault-desktop-1.2.0-setup.exe.blockmap",
			"latest.yml",
			"vault-desktop-1.2.0.AppImage",
			"vault-desktop_1.2.0_amd64.deb",
			"latest-linux.yml",
		]);
		// The GitHub publisher writes latest*.yml for the betas too
		expect(releaseAssets("vault-desktop", parseReleaseVersion("1.2.0-beta.1"))).toContain("latest-linux.yml");
	});
});
