import { useAppSelector } from "@store";
import { typeLabels } from "./Sidebar";

/**
 * Display name of the current sidebar filter
 */
export function useFilterLabel() {
	const filter = useAppSelector((state) => state.vault.filter);
	const snapshot = useAppSelector((state) => state.vault.snapshot);

	switch (filter.kind) {
		case "all":
			return "All items";
		case "favorites":
			return "Favorites";
		case "type":
			return typeLabels[filter.type];
		case "folder":
			return filter.id ? (snapshot?.folders.find((f) => f.id === filter.id)?.name ?? "Folder") : "No folder";
		case "organization":
			return snapshot?.organizations.find((o) => o.id === filter.id)?.name ?? "Organization";
		case "collection":
			return snapshot?.collections.find((c) => c.id === filter.id)?.name ?? "Collection";
		case "trash":
			return "Trash";
	}
}
