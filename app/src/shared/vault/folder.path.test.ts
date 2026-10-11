import { describe, expect, it } from "vite-plus/test";
import { folderSegments, joinFolderSegments } from "./folder.path";

describe("folderSegments", () => {
	it("splits a path and trims its segments", () => {
		expect(folderSegments(" Work / Projects ")).toEqual(["Work", "Projects"]);
	});

	it("drops empty segments", () => {
		expect(folderSegments("/Work//  /Projects/")).toEqual(["Work", "Projects"]);
		expect(folderSegments("  ")).toEqual([]);
		expect(folderSegments("")).toEqual([]);
	});
});

describe("joinFolderSegments", () => {
	it("joins segments with a slash", () => {
		expect(joinFolderSegments(["Work", "Projects"])).toBe("Work/Projects");
		expect(joinFolderSegments([])).toBe("");
	});
});
