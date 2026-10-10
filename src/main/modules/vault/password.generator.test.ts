import { describe, expect, it } from "vite-plus/test";
import { generateEncodedSecret } from "./password.generator";

describe("generateEncodedSecret", () => {
	it.each([8, 9, 24, 63, 128])("generates %i hex characters", (length) => {
		expect(generateEncodedSecret("hex", length)).toMatch(new RegExp(`^[0-9a-f]{${length}}$`));
	});

	it.each([8, 9, 10, 24, 63, 128])("generates %i base64 characters without padding", (length) => {
		expect(generateEncodedSecret("base64", length)).toMatch(new RegExp(`^[A-Za-z0-9+/]{${length}}$`));
	});

	it("is random", () => {
		expect(generateEncodedSecret("hex", 32)).not.toBe(generateEncodedSecret("hex", 32));
	});
});
