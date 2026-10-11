import { describe, expect, it } from "vite-plus/test";
import { buildFolderTree, countFolderTree, folderDeleteBlocker, folderRenameBlocker, moveChoices, normalizeFolderPath, type FolderNode } from "./vault.folders";

function shape(nodes: FolderNode[]): unknown[] {
	return nodes.map((node) => ({ name: node.name, id: node.id, children: shape(node.children) }));
}

describe("buildFolderTree", () => {
	it("nests folders by their name", () => {
		const tree = buildFolderTree([
			{ id: "b", name: "Work/Projects" },
			{ id: "a", name: "Work" },
			{ id: "c", name: "Personal" },
		]);

		expect(shape(tree)).toEqual([
			{ name: "Personal", id: "c", children: [] },
			{ name: "Work", id: "a", children: [{ name: "Projects", id: "b", children: [] }] },
		]);
	});

	it("creates virtual parents for missing folders", () => {
		const tree = buildFolderTree([{ id: "x", name: "A/B/C" }]);

		expect(shape(tree)).toEqual([{ name: "A", id: null, children: [{ name: "B", id: null, children: [{ name: "C", id: "x", children: [] }] }] }]);
		expect(tree[0].children[0].children[0].path).toBe("A/B/C");
	});

	it("ignores empty segments and keeps duplicates", () => {
		const tree = buildFolderTree([
			{ id: "1", name: "/Work//Mail/" },
			{ id: "2", name: "Work/Mail" },
		]);

		expect(shape(tree)).toEqual([
			{
				name: "Work",
				id: null,
				children: [
					{ name: "Mail", id: "1", children: [] },
					{ name: "Mail", id: "2", children: [] },
				],
			},
		]);
		expect(new Set(tree[0].children.map((node) => node.path)).size).toBe(2);
	});

	it("sorts siblings naturally", () => {
		const tree = buildFolderTree([
			{ id: "1", name: "Folder 10" },
			{ id: "2", name: "folder 2" },
			{ id: "3", name: "Écoles" },
		]);

		expect(tree.map((node) => node.name)).toEqual(["Écoles", "folder 2", "Folder 10"]);
	});
});

describe("countFolderTree", () => {
	it("sums the items of the subtree", () => {
		const [root] = buildFolderTree([
			{ id: "a", name: "Work" },
			{ id: "b", name: "Work/Projects" },
			{ id: "c", name: "Work/Old/Archive" },
		]);

		expect(countFolderTree(root, { a: 2, b: 3, c: 1 })).toBe(6);
	});
});

describe("folderDeleteBlocker", () => {
	const [root] = buildFolderTree([
		{ id: "a", name: "Work" },
		{ id: "b", name: "Work/Projects" },
	]);

	it("refuses a virtual node", () => {
		const [virtual] = buildFolderTree([{ id: "x", name: "A/B" }]);
		expect(folderDeleteBlocker(virtual, 0)).toBe("This folder only groups its sub folders");
	});

	it("refuses a folder with sub folders, even empty ones", () => {
		expect(folderDeleteBlocker(root, 0)).toBe("Delete its sub folders first");
	});

	it("refuses a folder holding active items", () => {
		expect(folderDeleteBlocker(root.children[0], 2)).toBe("Move or delete its items first");
	});

	it("allows an empty leaf", () => {
		expect(folderDeleteBlocker(root.children[0], 0)).toBeNull();
	});
});

describe("folderRenameBlocker", () => {
	it("refuses a duplicated name, on both folders", () => {
		const tree = buildFolderTree([
			{ id: "1", name: "Mail" },
			{ id: "2", name: "Mail" },
		]);

		expect(tree.map((node) => folderRenameBlocker(node))).toEqual(["Another folder has the same name", "Another folder has the same name"]);
	});

	it("allows a unique name", () => {
		const [node] = buildFolderTree([{ id: "1", name: "Mail" }]);
		expect(folderRenameBlocker(node)).toBeNull();
	});
});

describe("moveChoices", () => {
	const folders = [
		{ id: "b", name: "Work/Projects" },
		{ id: "a", name: "Work" },
		{ id: "c", name: "Écoles" },
		{ id: "d", name: "Personal" },
	];

	it("lists No folder first, then the folders in sidebar order with their full path", () => {
		expect(moveChoices(folders, "")).toEqual([
			{ id: null, path: "No folder" },
			{ id: "c", path: "Écoles" },
			{ id: "d", path: "Personal" },
			{ id: "a", path: "Work" },
			{ id: "b", path: "Work/Projects" },
		]);
	});

	it("filters on the full path, ignoring case and accents", () => {
		expect(moveChoices(folders, "  projects").map((choice) => choice.path)).toEqual(["Work/Projects"]);
		expect(moveChoices(folders, "no f").map((choice) => choice.path)).toEqual(["No folder"]);
		expect(moveChoices(folders, "ecoles").map((choice) => choice.path)).toEqual(["Écoles"]);
	});

	it("never offers a virtual parent", () => {
		const choices = moveChoices([{ id: "x", name: "A/B" }], "");
		expect(choices).toEqual([
			{ id: null, path: "No folder" },
			{ id: "x", path: "A/B" },
		]);
	});
});

describe("normalizeFolderPath", () => {
	it("trims segments and drops empty ones", () => {
		expect(normalizeFolderPath(" /Work / Projects// ")).toBe("Work/Projects");
	});
});
