import { describe, expect, it } from "vite-plus/test";
import {
	devReleaseNotes,
	devReleaseProblems,
	devReleasesToDelete,
	devTags,
	nextDevVersion,
	parseReleaseVersion,
	releaseAssets,
	releaseProblems,
	type DevRepositoryState,
	type RepositoryState,
} from "./release";

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

	it("ignores the development builds", () => {
		// 0.2.0-beta.1 < 0.2.0-dev.3 in semver: a beta stays possible after development builds
		expect(releaseProblems(parseReleaseVersion("0.2.0-beta.1"), { ...cleanMain, tags: ["v0.1.0", "v0.2.0-dev.3"] })).toEqual([]);
	});

	it("refuses a development version in package.json", () => {
		expect(() => parseReleaseVersion("0.2.0-dev.1")).toThrow();
	});
});

const pushedBranch: DevRepositoryState = { branch: "feat/x", dirty: false, upstream: "origin/feat/x", pushed: true };

describe("devReleaseProblems", () => {
	it("accepts any pushed branch, main included", () => {
		expect(devReleaseProblems(pushedBranch)).toEqual([]);
		expect(devReleaseProblems({ ...pushedBranch, branch: "main", upstream: "origin/main" })).toEqual([]);
	});

	it("requires a clean, pushed branch", () => {
		expect(devReleaseProblems({ ...pushedBranch, dirty: true })).toEqual(["The working tree has uncommitted changes"]);
		expect(devReleaseProblems({ ...pushedBranch, pushed: false })).toEqual(["HEAD is not origin/feat/x: push or pull first"]);
		expect(devReleaseProblems({ ...pushedBranch, upstream: null, pushed: false })).toHaveLength(1);
		expect(devReleaseProblems({ ...pushedBranch, branch: "HEAD" })).toHaveLength(1);
	});
});

describe("nextDevVersion", () => {
	it("starts at dev.1 of the version of package.json", () => {
		expect(nextDevVersion("0.2.0", ["v0.1.0"])).toEqual({ version: "0.2.0-dev.1", tag: "v0.2.0-dev.1", prerelease: true });
	});

	it("follows the development builds of the same version", () => {
		expect(nextDevVersion("0.2.0", ["v0.1.0", "v0.2.0-dev.1", "v0.2.0-dev.9", "v0.1.0-dev.20"]).version).toBe("0.2.0-dev.10");
	});

	it("drops the prerelease of package.json", () => {
		expect(nextDevVersion("0.2.0-beta.1", ["v0.1.0", "v0.2.0-beta.1"]).version).toBe("0.2.0-dev.1");
	});

	it("never goes below the latest development build", () => {
		// A branch still at 0.1.0 continues the numbering of 0.2.0: the new build stays the newest, kept by the cleanup
		const tags = ["v0.1.0", ...[1, 2, 3, 4, 5].map((n) => `v0.2.0-dev.${n}`)];
		const next = nextDevVersion("0.1.0", tags);
		expect(next.version).toBe("0.2.0-dev.6");
		expect(devReleasesToDelete([...tags, next.tag])).toEqual(["v0.2.0-dev.1"]);
	});

	it("never reuses a pruned number", () => {
		// dev.1 to dev.5 were deleted: the kept dev.10 carries the numbering on
		expect(nextDevVersion("0.2.0", ["v0.1.0", "v0.2.0-dev.6", "v0.2.0-dev.10"]).version).toBe("0.2.0-dev.11");
	});

	it("moves to the next patch once the version is released", () => {
		expect(nextDevVersion("0.2.0", ["v0.2.0", "v0.2.0-dev.4"]).version).toBe("0.2.1-dev.1");
		expect(nextDevVersion("0.2.0", ["v0.3.0", "v0.3.1-dev.2"]).version).toBe("0.3.1-dev.3");
	});
});

describe("devReleasesToDelete", () => {
	it("keeps the newest development builds only", () => {
		const tags = ["v0.1.0", "v0.2.0-beta.1", ...[1, 2, 3, 4, 5, 6, 7, 10].map((n) => `v0.2.0-dev.${n}`), "v0.2.1-dev.1"];
		expect(devTags(tags)[0]).toBe("v0.2.1-dev.1");
		expect(devReleasesToDelete(tags)).toEqual(["v0.2.0-dev.4", "v0.2.0-dev.3", "v0.2.0-dev.2", "v0.2.0-dev.1"]);
		expect(devReleasesToDelete(["v0.2.0-dev.1"])).toEqual([]);
	});
});

describe("devReleaseNotes", () => {
	it("lists the commits since the previous development build", () => {
		expect(devReleaseNotes("feat/x", "abc1234", "v0.2.0-dev.1", ["abc1234 fix: b", "def5678 feat: a"])).toBe(
			["Development build from `feat/x` @ abc1234.", "", "Commits since v0.2.0-dev.1:", "", "- abc1234 fix: b", "- def5678 feat: a", ""].join("\n")
		);
	});

	it("handles the first build and an empty range", () => {
		expect(devReleaseNotes("main", "abc1234", null, [])).toContain("First development build.");
		expect(devReleaseNotes("main", "abc1234", "v0.2.0-dev.1", [])).toContain("No new commit since v0.2.0-dev.1.");
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
		expect(releaseAssets("vault-desktop", nextDevVersion("1.2.0", []))).toContain("vault-desktop_1.2.0-dev.1_amd64.deb");
	});
});
