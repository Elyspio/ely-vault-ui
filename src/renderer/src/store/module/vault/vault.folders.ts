import type { VaultFolder } from "@shared/types/vault.types";

/**
 * Folder of the sidebar tree. Bitwarden nests folders through their name ("Work/Projects"):
 * a parent missing from the vault is a virtual node (id null) only used to group its children.
 */
export type FolderNode = {
	/** Full name, unique in the tree */
	path: string;
	/** Last segment of the path */
	name: string;
	id: string | null;
	children: FolderNode[];
};

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export function buildFolderTree(folders: VaultFolder[]): FolderNode[] {
	const roots: FolderNode[] = [];
	const nodes = new Map<string, FolderNode>();

	const getNode = (segments: string[]): FolderNode => {
		const path = segments.join("/");
		const existing = nodes.get(path);
		if (existing) return existing;

		const node: FolderNode = { path, name: segments.at(-1)!, id: null, children: [] };
		nodes.set(path, node);
		if (segments.length === 1) roots.push(node);
		else getNode(segments.slice(0, -1)).children.push(node);
		return node;
	};

	for (const folder of folders) {
		const segments = folder.name
			.split("/")
			.map((segment) => segment.trim())
			.filter(Boolean);
		if (segments.length === 0) continue;

		const node = getNode(segments);
		// Two folders with the same name: the second one stays a separate leaf
		if (node.id) getParentChildren(roots, nodes, segments).push({ path: `${node.path}#${folder.id}`, name: node.name, id: folder.id, children: [] });
		else node.id = folder.id;
	}

	sortTree(roots);
	return roots;
}

function getParentChildren(roots: FolderNode[], nodes: Map<string, FolderNode>, segments: string[]) {
	return segments.length === 1 ? roots : nodes.get(segments.slice(0, -1).join("/"))!.children;
}

function sortTree(nodes: FolderNode[]) {
	nodes.sort((a, b) => collator.compare(a.name, b.name));
	for (const node of nodes) sortTree(node.children);
}

/**
 * Number of items of a node and all its descendants
 */
export function countFolderTree(node: FolderNode, counts: Record<string, number>): number {
	return (node.id ? (counts[node.id] ?? 0) : 0) + node.children.reduce((total, child) => total + countFolderTree(child, counts), 0);
}
