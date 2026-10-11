import { createSelector } from "@reduxjs/toolkit";
import type { StoreState } from "@store";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { searchItems } from "./vault.search";

const emptyItems: VaultItem[] = [];

/** Active items: everything but the trash, the only source of the palette, the counts and the other filters */
export const selectItems = (state: StoreState) => state.vault.snapshot?.items ?? emptyItems;

/** Deleted items */
export const selectTrashItems = (state: StoreState) => state.vault.snapshot?.trash ?? emptyItems;

/**
 * Items of the list: the trash when the trash filter is active, the active items otherwise
 */
export const selectListSource = (state: StoreState) => (state.vault.filter.kind === "trash" ? selectTrashItems(state) : selectItems(state));

export const selectVisibleItems = createSelector([selectListSource, (state: StoreState) => state.vault.filter, (state: StoreState) => state.vault.query], (items, filter, query) =>
	searchItems(items, filter, query)
);

/**
 * Selected item, active or deleted: used by the detail panel, which is read-only for deleted items
 */
export const selectSelectedItem = createSelector(
	[selectItems, selectTrashItems, (state: StoreState) => state.vault.selectedId],
	(items, trash, id) => items.find((item) => item.id === id) ?? trash.find((item) => item.id === id) ?? null
);

/**
 * Selected active item only: every action that copies, types or opens a secret reads this one, so a deleted item can never be used by them
 */
export const selectActiveSelectedItem = createSelector([selectItems, (state: StoreState) => state.vault.selectedId], (items, id) => items.find((item) => item.id === id) ?? null);

export type VaultCounts = {
	all: number;
	favorites: number;
	types: Record<CipherType, number>;
	folders: Record<string, number>;
	noFolder: number;
	collections: Record<string, number>;
	organizations: Record<string, number>;
	trash: number;
};

/**
 * Counts of the sidebar. Active items and the trash are counted apart: deleted items never count in the other entries.
 */
export const selectCounts = createSelector([selectItems, selectTrashItems], (items, trash): VaultCounts => {
	const counts: VaultCounts = {
		all: items.length,
		favorites: 0,
		types: { [CipherType.Login]: 0, [CipherType.SecureNote]: 0, [CipherType.Card]: 0, [CipherType.Identity]: 0, [CipherType.SshKey]: 0 },
		folders: {},
		noFolder: 0,
		collections: {},
		organizations: {},
		trash: trash.length,
	};

	for (const item of items) {
		if (item.favorite) counts.favorites++;
		counts.types[item.type] = (counts.types[item.type] ?? 0) + 1;
		if (item.folderId) counts.folders[item.folderId] = (counts.folders[item.folderId] ?? 0) + 1;
		else if (!item.organizationId) counts.noFolder++;
		if (item.organizationId) counts.organizations[item.organizationId] = (counts.organizations[item.organizationId] ?? 0) + 1;
		for (const id of item.collectionIds) counts.collections[id] = (counts.collections[id] ?? 0) + 1;
	}

	return counts;
});
