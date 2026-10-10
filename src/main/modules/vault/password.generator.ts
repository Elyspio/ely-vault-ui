import crypto from "node:crypto";

/**
 * Random secret of `length` characters: each hex character carries 4 random bits, each base64 character 6
 */
export function generateEncodedSecret(encoding: "hex" | "base64", length: number) {
	const bytes = encoding === "hex" ? Math.ceil(length / 2) : Math.ceil((length * 3) / 4);
	return crypto.randomBytes(bytes).toString(encoding).slice(0, length);
}
