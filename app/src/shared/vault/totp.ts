/**
 * Shape of the TOTP values Bitwarden accepts; shared so the editor can validate while typing. No code is computed here.
 */

/** Accepts a base32 secret, an otpauth://totp uri or a steam:// secret. No TOTP is computed here. */
export function isValidTotp(value: string): boolean {
	const trimmed = value.trim();
	const lower = trimmed.toLowerCase();

	if (lower.startsWith("otpauth://")) {
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			return false;
		}
		if (url.protocol !== "otpauth:" || url.host !== "totp") return false;
		return isBase32Secret(url.searchParams.get("secret") ?? "");
	}

	if (lower.startsWith("steam://")) return isBase32Secret(trimmed.slice("steam://".length));

	return isBase32Secret(trimmed);
}

function isBase32Secret(value: string): boolean {
	const cleaned = value.replaceAll(/[\s=]/g, "");
	return cleaned.length >= 16 && /^[A-Z2-7]+$/i.test(cleaned);
}
