import { createSelector } from "@reduxjs/toolkit";
import type { StoreState } from "@store";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { searchItems } from "./vault.search";

const emptyItems: VaultItem[] = [];

export const selectItems = (state: StoreState) => state.vault.snapshot?.items ?? emptyItems;

export const selectVisibleItems = createSelector([selectItems, (state: StoreState) => state.vault.filter, (state: StoreState) => state.vault.query], (items, filter, query) =>
	searchItems(items, filter, query)
);

export const selectSelectedItem = createSelector([selectItems, (state: StoreState) => state.vault.selectedId], (items, id) => items.find((item) => item.id === id) ?? null);

export type VaultCounts = {
	all: number;
	favorites: number;
	types: Record<CipherType, number>;
	folders: Record<string, number>;
	noFolder: number;
	collections: Record<string, number>;
	organizations: Record<string, number>;
};

export const selectCounts = createSelector([selectItems], (items): VaultCounts => {
	const counts: VaultCounts = {
		all: items.length,
		favorites: 0,
		types: { [CipherType.Login]: 0, [CipherType.SecureNote]: 0, [CipherType.Card]: 0, [CipherType.Identity]: 0, [CipherType.SshKey]: 0 },
		folders: {},
		noFolder: 0,
		collections: {},
		organizations: {},
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
