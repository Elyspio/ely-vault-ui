/**
 * Segments of a folder name: Bitwarden nests folders through their name ("Work/Projects").
 * Empty segments are dropped and the others trimmed.
 */
export function folderSegments(name: string): string[] {
	return name
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);
}

/**
 * Folder name built from its segments
 */
export function joinFolderSegments(segments: string[]): string {
	return segments.join("/");
}
