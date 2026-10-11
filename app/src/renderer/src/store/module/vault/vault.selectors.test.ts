import { describe, expect, it } from "vite-plus/test";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import type { StoreState } from "@store";
import { selectActiveSelectedItem, selectCounts, selectSelectedItem, selectVisibleItems } from "./vault.selectors";
import type { VaultFilter } from "./vault.search";

function item(id: string, overrides: Partial<VaultItem> = {}): VaultItem {
	return {
		id,
		type: CipherType.Login,
		name: id,
		notes: null,
		favorite: false,
		reprompt: false,
		folderId: null,
		organizationId: null,
		collectionIds: [],
		revisionDate: "2026-10-10T12:00:00.000Z",
		creationDate: null,
		deletedDate: null,
		fields: [],
		passwordHistoryCount: 0,
		...overrides,
	};
}

const active = [item("a", { favorite: true }), item("b")];
const trash = [item("t1", { deletedDate: "2026-10-01T10:00:00.000Z", favorite: true })];

function state(filter: VaultFilter, selectedId: string | null = null, query = "") {
	return { vault: { snapshot: { items: active, trash }, filter, query, selectedId } } as unknown as StoreState;
}

describe("vault selectors", () => {
	it("lists the trash only with the trash filter", () => {
		expect(selectVisibleItems(state({ kind: "trash" })).map((i) => i.id)).toEqual(["t1"]);
		expect(selectVisibleItems(state({ kind: "all" })).map((i) => i.id)).toEqual(["a", "b"]);
		expect(selectVisibleItems(state({ kind: "favorites" })).map((i) => i.id)).toEqual(["a"]);
	});

	it("selects a deleted item for the detail, but not for the active-only selector", () => {
		expect(selectSelectedItem(state({ kind: "trash" }, "t1"))?.id).toBe("t1");
		expect(selectActiveSelectedItem(state({ kind: "trash" }, "t1"))).toBeNull();
		expect(selectActiveSelectedItem(state({ kind: "all" }, "a"))?.id).toBe("a");
	});

	it("counts the trash apart from the other entries", () => {
		const counts = selectCounts(state({ kind: "all" }));
		expect(counts.trash).toBe(1);
		expect(counts.all).toBe(2);
		expect(counts.favorites).toBe(1);
	});
});
