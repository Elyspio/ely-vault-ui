import jsQR from "jsqr";
import { isValidTotp } from "@shared/vault/totp";
import type { TotpQrResult } from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";

/**
 * Reads the TOTP secret (base32, otpauth://totp uri or steam://) of a QR code in an RGBA image.
 * The decoded text is only returned when it is a valid TOTP value: other QR codes are refused without echoing them.
 */
export function decodeTotpQr(rgba: Uint8ClampedArray, width: number, height: number): TotpQrResult {
	if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
		return { status: "error", message: appMessage("qrInvalidImage") };
	}

	const code = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
	if (!code) return { status: "error", message: appMessage("qrNotFound") };

	const value = code.data.trim();
	if (!isValidTotp(value)) return { status: "error", message: appMessage("qrNotTotp") };

	return { status: "success", value };
}
