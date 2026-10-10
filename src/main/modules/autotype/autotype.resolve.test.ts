import { describe, expect, it } from "vite-plus/test";
import { getItemSequence } from "./autotype.resolve";
import type { BwItem } from "../bitwarden/bw.types";
import { CipherType, FieldType } from "@shared/types/vault.types";
import { defaultAppConfig } from "@shared/config/app.config";

const base: BwItem = {
	id: "item-1",
	folderId: null,
	type: CipherType.Login,
	reprompt: 0,
	name: "GitHub",
	favorite: false,
	revisionDate: "2026-10-10T12:00:00.000Z",
};

const config = defaultAppConfig.autoType;

describe("getItemSequence", () => {
	it("adds Enter to the default sequence when configured", () => {
		expect(getItemSequence(base, config)).toEqual([
			{ kind: "field", field: "username" },
			{ kind: "key", key: "tab" },
			{ kind: "field", field: "password" },
			{ kind: "key", key: "enter" },
		]);
	});

	it("does not add Enter when disabled", () => {
		expect(getItemSequence(base, { ...config, pressEnter: false }).at(-1)).toEqual({ kind: "field", field: "password" });
	});

	it("types the item's autotype field as is, whatever the Enter setting", () => {
		const item: BwItem = { ...base, fields: [{ name: " AutoType ", value: "{PASSWORD}", type: FieldType.Hidden }] };
		expect(getItemSequence(item, config)).toEqual([{ kind: "field", field: "password" }]);
	});

	it("ignores an empty autotype field", () => {
		const item: BwItem = { ...base, fields: [{ name: "autotype", value: " ", type: FieldType.Text }] };
		expect(getItemSequence(item, { ...config, pressEnter: false })).toHaveLength(3);
	});

	it("explains which sequence is invalid", () => {
		const item: BwItem = { ...base, fields: [{ name: "autotype", value: "x{secret}", type: FieldType.Hidden }] };
		expect(() => getItemSequence(item, config)).toThrow("Séquence « autotype » de l'élément invalide (position 2)");
		expect(() => getItemSequence(base, { ...config, defaultSequence: "{FOO" })).toThrow(/^Séquence par défaut invalide/);
	});
});
