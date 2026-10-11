import QRCode from "qrcode";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { TotpQrModule } from "./totp.qr.module";
import { appMessage } from "@shared/i18n/message";

type FakeImage = {
	isEmpty: () => boolean;
	getSize: () => { width: number; height: number };
	toBitmap: () => Buffer;
	resize: (size: { width: number; height: number }) => FakeImage;
};

/** Image the fake clipboard holds as PNG, null when it only holds text */
let clipboardImage: FakeImage | null;

// The PNG bytes do not matter: the fake nativeImage decodes them into the current test image
vi.mock("electron", () => ({
	clipboard: {
		read: async () =>
			clipboardImage ? [{ types: ["text/plain", "image/png"], getType: async () => new Blob([new Uint8Array([137, 80, 78, 71])]) }] : [{ types: ["text/plain"] }],
	},
	nativeImage: { createFromBuffer: () => clipboardImage },
}));

// Logs go to winston and the app folder: the module only needs a logger object here
vi.mock("../log.module", () => ({
	LogModule: class {
		public logger = { info: () => undefined, debug: () => undefined, warn: () => undefined, error: () => undefined };
	},
}));

/** Image of a QR code as BGRA, like `toBitmap()` on Windows (black and white: the channel order does not change it) */
function qrImage(text: string, scale: number, margin = 4): FakeImage {
	const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
	const side = (modules.size + margin * 2) * scale;
	const bgra = Buffer.alloc(side * side * 4, 255);
	for (let y = 0; y < modules.size; y++) {
		for (let x = 0; x < modules.size; x++) {
			if (!modules.data[y * modules.size + x]) continue;
			for (let dy = 0; dy < scale; dy++) {
				for (let dx = 0; dx < scale; dx++) {
					const px = ((y + margin) * scale + dy) * side + (x + margin) * scale + dx;
					bgra[px * 4] = 0;
					bgra[px * 4 + 1] = 0;
					bgra[px * 4 + 2] = 0;
				}
			}
		}
	}
	return fakeImage(bgra, side, side);
}

function fakeImage(bitmap: Buffer, width: number, height: number): FakeImage {
	return {
		isEmpty: () => false,
		getSize: () => ({ width, height }),
		toBitmap: () => bitmap,
		resize: ({ width: newWidth, height: newHeight }) => {
			// Nearest neighbour is enough for this fake: the decoder only needs the modules to stay readable
			const out = Buffer.alloc(newWidth * newHeight * 4, 255);
			for (let y = 0; y < newHeight; y++) {
				for (let x = 0; x < newWidth; x++) {
					const sx = Math.floor((x * width) / newWidth);
					const sy = Math.floor((y * height) / newHeight);
					bitmap.copy(out, (y * newWidth + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
				}
			}
			return fakeImage(out, newWidth, newHeight);
		},
	};
}

describe("TotpQrModule", () => {
	let module: TotpQrModule;

	beforeEach(() => {
		module = new TotpQrModule();
	});

	it("asks for a screenshot when the clipboard holds no image", async () => {
		clipboardImage = null;

		expect(await module.readFromClipboard()).toEqual({ status: "error", message: appMessage("qrScreenshotRequired") });
	});

	it("asks for a screenshot when the clipboard image is empty", async () => {
		clipboardImage = { ...fakeImage(Buffer.alloc(0), 0, 0), isEmpty: () => true };

		expect(await module.readFromClipboard()).toEqual({ status: "error", message: appMessage("qrScreenshotRequired") });
	});

	it("refuses an image too large to be a QR code screenshot", async () => {
		clipboardImage = fakeImage(Buffer.alloc(0), 5000, 100);

		expect(await module.readFromClipboard()).toEqual({ status: "error", message: appMessage("qrImageTooLarge") });
	});

	it("reads a TOTP secret from a clipboard image", async () => {
		const uri = "otpauth://totp/Example:me@example.com?secret=JBSWY3DPEHPK3PXP";
		clipboardImage = qrImage(uri, 4);

		expect(await module.readFromClipboard()).toEqual({ status: "success", value: uri });
	});

	it("reads a QR code from a large image scaled down before decoding", async () => {
		const uri = "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP";
		// Over 2048 px wide (under the refusal limit): the image is resized first
		clipboardImage = qrImage(uri, 70, 2);

		expect(clipboardImage!.getSize().width).toBeGreaterThan(2048);
		expect(await module.readFromClipboard()).toEqual({ status: "success", value: uri });
	});
});
