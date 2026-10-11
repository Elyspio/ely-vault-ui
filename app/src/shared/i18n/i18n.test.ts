import { describe, expect, it } from "vite-plus/test";
import i18next from "i18next";
import { en } from "./en";
import { fr } from "./fr";
import { resolveLanguage } from "./i18n.languages";
import { appMessage, isAppMessage, parseAppMessage } from "./message";
import { i18nOptions } from "./resources";

type Texts = { [key: string]: string | Texts };

/** Every text of a translation, by its full key ("auth.login.title") */
function flatten(texts: Texts, prefix = ""): Map<string, string> {
	const entries = new Map<string, string>();
	for (const [key, value] of Object.entries(texts)) {
		if (typeof value === "string") entries.set(prefix + key, value);
		else for (const [child, text] of flatten(value, `${prefix}${key}.`)) entries.set(child, text);
	}
	return entries;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).toSorted();

describe("resolveLanguage", () => {
	it("keeps an explicit language", () => {
		expect(resolveLanguage("fr", ["en-US"])).toBe("fr");
		expect(resolveLanguage("en", ["fr-FR"])).toBe("en");
	});

	it("follows the first supported system locale", () => {
		expect(resolveLanguage("system", ["fr-FR", "en-US"])).toBe("fr");
		expect(resolveLanguage("system", ["fr-CA"])).toBe("fr");
		expect(resolveLanguage("system", ["de-DE", "fr_BE", "en"])).toBe("fr");
		expect(resolveLanguage("system", ["en-GB", "fr-FR"])).toBe("en");
	});

	it("falls back to English", () => {
		expect(resolveLanguage("system", ["de-DE", "ja"])).toBe("en");
		expect(resolveLanguage("system", [])).toBe("en");
	});
});

describe("appMessage", () => {
	it("encodes a key and its parameters", () => {
		expect(parseAppMessage(appMessage("folderNotFound"))).toEqual({ key: "folderNotFound", params: undefined });
		expect(parseAppMessage(appMessage("noFolderUnder", { path: 'Work "A"\nB' }))).toEqual({ key: "noFolderUnder", params: { path: 'Work "A"\nB' } });
	});

	it("leaves raw texts alone", () => {
		expect(parseAppMessage("Server unreachable")).toBeNull();
		expect(parseAppMessage("i18n:broken {not json}")).toBeNull();
		expect(isAppMessage(appMessage("vaultLocked"), "vaultLocked")).toBe(true);
		expect(isAppMessage("The vault is locked", "vaultLocked")).toBe(false);
	});
});

describe("translations", () => {
	const english = flatten(en);
	const french = flatten(fr as Texts);

	it("translates every English text", () => {
		for (const key of english.keys()) expect(french.has(key), key).toBe(true);
		for (const key of french.keys()) expect(english.has(key) || english.has(key.replace(/_many$/, "_other")), key).toBe(true);
	});

	it("keeps the placeholders of the English texts", () => {
		for (const [key, text] of english) expect(placeholders(french.get(key) ?? ""), key).toEqual(placeholders(text));
		for (const [key, text] of french) {
			if (key.endsWith("_many")) expect(placeholders(text), key).toEqual(placeholders(english.get(key.replace(/_many$/, "_other"))!));
		}
	});

	it("has no empty text", () => {
		for (const [key, text] of [...english, ...french]) expect(text.trim(), key).not.toBe("");
	});

	it("uses the plurals of each language", () => {
		const i18n = i18next.createInstance();
		void i18n.init({
			...i18nOptions,
			resources: {
				en: { test: { item_one: "{{count}} item", item_other: "{{count}} items" } },
				fr: { test: { item_one: "{{count}} élément", item_other: "{{count}} éléments", item_many: "{{count}} d'éléments" } },
			},
			ns: ["test"],
			defaultNS: "test",
		});
		const t = (lng: string, count: number) => i18n.t("item" as never, { lng, count });
		expect([t("en", 0), t("en", 1), t("en", 2)]).toEqual(["0 items", "1 item", "2 items"]);
		expect([t("fr", 0), t("fr", 1), t("fr", 2), t("fr", 1_000_000)]).toEqual(["0 élément", "1 élément", "2 éléments", "1000000 d'éléments"]);
	});
});
