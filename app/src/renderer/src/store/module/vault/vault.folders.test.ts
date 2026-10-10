import { describe, expect, it } from "vite-plus/test";
import { buildFolderTree, countFolderTree, type FolderNode } from "./vault.folders";

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
