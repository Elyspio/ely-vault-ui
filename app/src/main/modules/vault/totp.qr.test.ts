import QRCode from "qrcode";
import { describe, expect, it } from "vite-plus/test";
import { decodeTotpQr } from "./totp.qr";
import { appMessage } from "@shared/i18n/message";

/** RGBA image of a QR code: dark modules black, a quiet zone around, each module drawn `scale` pixels wide */
function renderQr(text: string, scale = 4, margin = 4) {
	const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
	const side = (modules.size + margin * 2) * scale;
	const rgba = new Uint8ClampedArray(side * side * 4).fill(255);
	for (let y = 0; y < modules.size; y++) {
		for (let x = 0; x < modules.size; x++) {
			if (!modules.data[y * modules.size + x]) continue;
			for (let dy = 0; dy < scale; dy++) {
				for (let dx = 0; dx < scale; dx++) {
					const px = ((y + margin) * scale + dy) * side + (x + margin) * scale + dx;
					rgba[px * 4] = 0;
					rgba[px * 4 + 1] = 0;
					rgba[px * 4 + 2] = 0;
				}
			}
		}
	}
	return { rgba, width: side, height: side };
}

describe("decodeTotpQr", () => {
	it("reads an otpauth://totp uri", () => {
		const uri = "otpauth://totp/Example:me@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";
		const { rgba, width, height } = renderQr(uri);

		expect(decodeTotpQr(rgba, width, height)).toEqual({ status: "success", value: uri });
	});

	it("reads a bare base32 secret", () => {
		const { rgba, width, height } = renderQr("JBSWY3DPEHPK3PXP");

		expect(decodeTotpQr(rgba, width, height)).toEqual({ status: "success", value: "JBSWY3DPEHPK3PXP" });
	});

	it("refuses a QR code that is not a TOTP secret, without echoing it", () => {
		const { rgba, width, height } = renderQr("https://example.com");
		const result = decodeTotpQr(rgba, width, height);

		expect(result).toEqual({ status: "error", message: appMessage("qrNotTotp") });
		expect(JSON.stringify(result)).not.toContain("example.com");
	});

	it("refuses an otpauth://hotp uri", () => {
		const { rgba, width, height } = renderQr("otpauth://hotp/Example?secret=JBSWY3DPEHPK3PXP&counter=1");

		expect(decodeTotpQr(rgba, width, height).status).toBe("error");
	});

	it("reports an image without QR code", () => {
		const width = 120;
		const height = 80;
		const rgba = new Uint8ClampedArray(width * height * 4).fill(255);

		expect(decodeTotpQr(rgba, width, height)).toEqual({ status: "error", message: appMessage("qrNotFound") });
	});

	it("refuses a buffer that does not match the size", () => {
		expect(decodeTotpQr(new Uint8ClampedArray(16), 10, 10).status).toBe("error");
	});
});
