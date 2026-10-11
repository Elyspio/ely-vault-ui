import { useAppSelector } from "@store";
import { useTranslation } from "react-i18next";
import { typeLabelKeys } from "./Sidebar";

/**
 * Display name of the current sidebar filter
 */
export function useFilterLabel() {
	const filter = useAppSelector((state) => state.vault.filter);
	const snapshot = useAppSelector((state) => state.vault.snapshot);
	const { t } = useTranslation("vault");

	switch (filter.kind) {
		case "all":
			return t("filters.all");
		case "favorites":
			return t("filters.favorites");
		case "type":
			return t(`types.${typeLabelKeys[filter.type]}`);
		case "folder":
			return filter.id ? (snapshot?.folders.find((f) => f.id === filter.id)?.name ?? t("filters.folder")) : t("filters.noFolder");
		case "organization":
			return snapshot?.organizations.find((o) => o.id === filter.id)?.name ?? t("filters.organization");
		case "collection":
			return snapshot?.collections.find((c) => c.id === filter.id)?.name ?? t("filters.collection");
		case "trash":
			return t("filters.trash");
	}
}
