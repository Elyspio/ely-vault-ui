import { folderSegments, joinFolderSegments } from "@shared/vault/folder.path";
import type { VaultFolder } from "@shared/types/vault.types";

/**
 * Folder of the sidebar tree. Bitwarden nests folders through their name ("Work/Projects"):
 * a parent missing from the vault is a virtual node (id null) only used to group its children.
 */
export type FolderNode = {
	/** Key of the node, unique in the tree: the full name, suffixed with the folder id for a duplicated name */
	path: string;
	/** Normalized full name: what the folder operations take (equal to `path` unless the name is duplicated) */
	fullName: string;
	/** Last segment of the path */
	name: string;
	id: string | null;
	/** Another folder has the same full name: renaming it would rename both */
	duplicated: boolean;
	children: FolderNode[];
};

/**
 * Folder of the move picker: `id` null is "No folder"
 */
export type FolderChoice = { id: string | null; path: string };

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function buildFolderTree(folders: VaultFolder[]): FolderNode[] {
	const roots: FolderNode[] = [];
	const nodes = new Map<string, FolderNode>();

	const getNode = (segments: string[]): FolderNode => {
		const path = segments.join("/");
		const existing = nodes.get(path);
		if (existing) return existing;

		const node: FolderNode = { path, fullName: path, name: segments.at(-1)!, id: null, duplicated: false, children: [] };
		nodes.set(path, node);
		if (segments.length === 1) roots.push(node);
		else getNode(segments.slice(0, -1)).children.push(node);
		return node;
	};

	for (const folder of folders) {
		const segments = folderSegments(folder.name);
		if (segments.length === 0) continue;

		const node = getNode(segments);
		if (node.id) {
			// Two folders with the same name: the second one stays a separate leaf
			node.duplicated = true;
			getParentChildren(roots, nodes, segments).push({
				path: `${node.path}#${folder.id}`,
				fullName: node.path,
				name: node.name,
				id: folder.id,
				duplicated: true,
				children: [],
			});
		} else {
			node.id = folder.id;
		}
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

/**
 * Why a folder cannot be deleted, null when it can. `activeItems`: active items directly in the folder (the trash excluded)
 */
export function folderDeleteBlocker(node: FolderNode, activeItems: number): string | null {
	if (!node.id) return "This folder only groups its sub folders";
	if (node.children.length > 0) return "Delete its sub folders first";
	if (activeItems > 0) return "Move or delete its items first";
	return null;
}

/**
 * Why a folder cannot be renamed, null when it can
 */
export function folderRenameBlocker(node: FolderNode): string | null {
	return node.duplicated ? "Another folder has the same name" : null;
}

/**
 * Choices of the move picker: "No folder", then every folder in the sidebar order, all filtered by the query
 * (case and accents ignored, substring of the full path).
 */
export function moveChoices(folders: VaultFolder[], query: string): FolderChoice[] {
	const all: FolderChoice[] = [];
	const walk = (nodes: FolderNode[]) => {
		for (const node of nodes) {
			if (node.id) all.push({ id: node.id, path: node.fullName });
			walk(node.children);
		}
	};
	walk(buildFolderTree(folders));

	// "No folder" is filtered like the others: typing a folder name must not leave it highlighted first
	const needle = foldText(query);
	return [{ id: null, path: "No folder" }, ...all].filter((choice) => foldText(choice.path).includes(needle));
}

/**
 * Normalized name typed by the user ("  Work / Projects " → "Work/Projects")
 */
export function normalizeFolderPath(value: string): string {
	return joinFolderSegments(folderSegments(value));
}

/** Lower case without accents, for the search */
function foldText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}
