import { describe, expect, it } from "vite-plus/test";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { getItemSubtitle, matchesFilter, neighbourId, searchItems } from "./vault.search";

function item(name: string, overrides: Partial<VaultItem> = {}): VaultItem {
	return {
		id: name,
		type: CipherType.Login,
		name,
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
		login: { username: null, uris: [], hasPassword: true, hasTotp: false, passwordRevisionDate: null, passkeyCount: 0 },
		...overrides,
	};
}

const items = [
	item("Slack", {
		login: {
			username: "jean@company.com",
			uris: [{ uri: "https://company.slack.com", host: "company.slack.com", match: null }],
			hasPassword: true,
			hasTotp: false,
			passwordRevisionDate: null,
			passkeyCount: 0,
		},
	}),
	item("GitHub", { favorite: true, folderId: "work" }),
	item("Banque Populaire", { folderId: "money" }),
	item("Électricité EDF"),
	item("Visa personal", {
		type: CipherType.Card,
		login: undefined,
		card: { cardholderName: "JEAN", brand: "Visa", expMonth: "08", expYear: "2029", numberLast4: "1111", hasNumber: true, hasCode: true },
	}),
];

describe("searchItems", () => {
	it("sorts by name without query", () => {
		expect(searchItems(items, { kind: "all" }, "").map((i) => i.name)).toEqual(["Banque Populaire", "Électricité EDF", "GitHub", "Slack", "Visa personal"]);
	});

	it("ranks a name prefix before a match in other fields", () => {
		const names = searchItems([...items, item("Company VPN")], { kind: "all" }, "comp").map((i) => i.name);
		expect(names).toEqual(["Company VPN", "Slack"]);
	});

	it("ignores accents and case, and needs every word", () => {
		expect(searchItems(items, { kind: "all" }, "electricite").map((i) => i.name)).toEqual(["Électricité EDF"]);
		expect(searchItems(items, { kind: "all" }, "banque pop").map((i) => i.name)).toEqual(["Banque Populaire"]);
		expect(searchItems(items, { kind: "all" }, "banque github")).toEqual([]);
	});

	it("applies the filter", () => {
		expect(searchItems(items, { kind: "favorites" }, "").map((i) => i.name)).toEqual(["GitHub"]);
		expect(searchItems(items, { kind: "folder", id: "money" }, "").map((i) => i.name)).toEqual(["Banque Populaire"]);
		expect(searchItems(items, { kind: "type", type: CipherType.Card }, "").map((i) => i.name)).toEqual(["Visa personal"]);
	});
});

describe("getItemSubtitle", () => {
	it("shows the username of a login and the masked number of a card", () => {
		expect(getItemSubtitle(items[0])).toBe("jean@company.com");
		expect(getItemSubtitle(items[4])).toBe("Visa •••• 1111");
	});
});

describe("trash filter", () => {
	const trashed = [item("Old forum", { deletedDate: "2026-10-01T10:00:00.000Z" }), item("Old bank", { deletedDate: "2026-10-02T10:00:00.000Z" })];

	it("matches only deleted items", () => {
		expect(matchesFilter(trashed[0], { kind: "trash" })).toBe(true);
		expect(matchesFilter(items[0], { kind: "trash" })).toBe(false);
	});

	it("never lets a deleted item into the other filters", () => {
		expect(matchesFilter(trashed[0], { kind: "all" })).toBe(false);
		expect(matchesFilter(trashed[0], { kind: "favorites" })).toBe(false);
		expect(searchItems(trashed, { kind: "all" }, "")).toEqual([]);
	});

	it("searches inside the trash", () => {
		expect(searchItems(trashed, { kind: "trash" }, "bank").map((i) => i.name)).toEqual(["Old bank"]);
	});
});

describe("neighbourId", () => {
	const list = [item("a"), item("b"), item("c")];

	it("picks the next item, else the previous one, else none", () => {
		expect(neighbourId(list, "a")).toBe("b");
		expect(neighbourId(list, "c")).toBe("b");
		expect(neighbourId([item("only")], "only")).toBeNull();
		expect(neighbourId(list, "missing")).toBeNull();
	});
});
