import { describe, expect, it } from "vite-plus/test";
import { AutoTypeSequenceError, parseAutoTypeSequence, validateAutoTypeSequence } from "./autotype.sequence";
import { appMessage } from "../i18n/message";

describe("parseAutoTypeSequence", () => {
	it("parses the default sequence", () => {
		expect(parseAutoTypeSequence("{USERNAME}{TAB}{PASSWORD}{ENTER}")).toEqual([
			{ kind: "field", field: "username" },
			{ kind: "key", key: "tab" },
			{ kind: "field", field: "password" },
			{ kind: "key", key: "enter" },
		]);
	});

	it("ignores the case of placeholders", () => {
		expect(parseAutoTypeSequence("{username}{Totp}")).toEqual([
			{ kind: "field", field: "username" },
			{ kind: "field", field: "totp" },
		]);
	});

	it("keeps literal text between placeholders", () => {
		expect(parseAutoTypeSequence("DOMAIN\\{USERNAME} x")).toEqual([
			{ kind: "text", value: "DOMAIN\\" },
			{ kind: "field", field: "username" },
			{ kind: "text", value: " x" },
		]);
	});

	it("types escaped braces as text", () => {
		expect(parseAutoTypeSequence("a{{}b{}}c")).toEqual([{ kind: "text", value: "a{b}c" }]);
	});

	it("parses delays", () => {
		expect(parseAutoTypeSequence("{DELAY 500}{delay  20}")).toEqual([
			{ kind: "delay", ms: 500 },
			{ kind: "delay", ms: 20 },
		]);
	});

	it("rejects unknown placeholders", () => {
		expect(() => parseAutoTypeSequence("{USERNAME}{URL}")).toThrow(AutoTypeSequenceError);
		expect(() => parseAutoTypeSequence("{DELAY}")).toThrow(AutoTypeSequenceError);
		expect(() => parseAutoTypeSequence("{DELAY -1}")).toThrow(AutoTypeSequenceError);
	});

	it("rejects unclosed braces and too long delays", () => {
		expect(() => parseAutoTypeSequence("{USERNAME")).toThrow(AutoTypeSequenceError);
		expect(() => parseAutoTypeSequence("{DELAY 60000}")).toThrow(AutoTypeSequenceError);
	});

	it("rejects control characters", () => {
		expect(() => parseAutoTypeSequence("a\tb")).toThrow(AutoTypeSequenceError);
		expect(() => parseAutoTypeSequence("{USERNAME}\n")).toThrow(AutoTypeSequenceError);
	});

	it("gives the position of the error", () => {
		expect(() => parseAutoTypeSequence("ab{FOO}")).toThrow(expect.objectContaining({ position: 3 }));
	});

	it("returns no token for an empty sequence", () => {
		expect(parseAutoTypeSequence("")).toEqual([]);
	});
});

describe("validateAutoTypeSequence", () => {
	it("returns null for a valid sequence and the message otherwise", () => {
		expect(validateAutoTypeSequence("{USERNAME}{TAB}{PASSWORD}")).toBeNull();
		expect(validateAutoTypeSequence("{FOO}")).toBe(appMessage("sequenceUnknownCode", { code: "{FOO}" }));
	});
});
