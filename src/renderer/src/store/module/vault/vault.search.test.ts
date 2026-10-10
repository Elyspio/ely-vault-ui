import { describe, expect, it } from "vite-plus/test";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { getItemSubtitle, searchItems } from "./vault.search";

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
		fields: [],
		passwordHistoryCount: 0,
		login: { username: null, uris: [], hasPassword: true, hasTotp: false, passwordRevisionDate: null },
		...overrides,
	};
}

const items = [
	item("Slack", {
		login: {
			username: "jean@entreprise.fr",
			uris: [{ uri: "https://entreprise.slack.com", host: "entreprise.slack.com" }],
			hasPassword: true,
			hasTotp: false,
			passwordRevisionDate: null,
		},
	}),
	item("GitHub", { favorite: true, folderId: "work" }),
	item("Banque Populaire", { folderId: "money" }),
	item("Électricité EDF"),
	item("Visa perso", {
		type: CipherType.Card,
		login: undefined,
		card: { cardholderName: "JEAN", brand: "Visa", expMonth: "08", expYear: "2029", numberLast4: "1111", hasNumber: true, hasCode: true },
	}),
];

describe("searchItems", () => {
	it("sorts by name without query", () => {
		expect(searchItems(items, { kind: "all" }, "").map((i) => i.name)).toEqual(["Banque Populaire", "Électricité EDF", "GitHub", "Slack", "Visa perso"]);
	});

	it("ranks a name prefix before a match in other fields", () => {
		const names = searchItems([...items, item("Entreprise VPN")], { kind: "all" }, "entre").map((i) => i.name);
		expect(names).toEqual(["Entreprise VPN", "Slack"]);
	});

	it("ignores accents and case, and needs every word", () => {
		expect(searchItems(items, { kind: "all" }, "electricite").map((i) => i.name)).toEqual(["Électricité EDF"]);
		expect(searchItems(items, { kind: "all" }, "banque pop").map((i) => i.name)).toEqual(["Banque Populaire"]);
		expect(searchItems(items, { kind: "all" }, "banque github")).toEqual([]);
	});

	it("applies the filter", () => {
		expect(searchItems(items, { kind: "favorites" }, "").map((i) => i.name)).toEqual(["GitHub"]);
		expect(searchItems(items, { kind: "folder", id: "money" }, "").map((i) => i.name)).toEqual(["Banque Populaire"]);
		expect(searchItems(items, { kind: "type", type: CipherType.Card }, "").map((i) => i.name)).toEqual(["Visa perso"]);
	});
});

describe("getItemSubtitle", () => {
	it("shows the username of a login and the masked number of a card", () => {
		expect(getItemSubtitle(items[0])).toBe("jean@entreprise.fr");
		expect(getItemSubtitle(items[4])).toBe("Visa •••• 1111");
	});
});
