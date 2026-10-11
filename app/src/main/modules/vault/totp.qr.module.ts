import { clipboard, nativeImage } from "electron";
import { injectable } from "inversify";
import { LogModule } from "../log.module";
import { decodeTotpQr } from "./totp.qr";
import type { TotpQrResult } from "@shared/types/vault.types";

/** Larger clipboard images are refused: a screenshot of a QR code never needs that much */
const MAX_SIDE = 4096;
/** Images are scaled down to this longest side before decoding: enough for a QR code, bounded memory and time */
const DECODE_SIDE = 2048;

/**
 * Reads a TOTP secret from a QR code copied to the clipboard (screenshot). The image never leaves the main process,
 * and the decoded value is only returned to the caller (the item draft), never logged.
 */
@injectable()
export class TotpQrModule extends LogModule {
	public constructor() {
		super("TotpQrModule");
	}

	/**
	 * Decodes the image in the clipboard into a TOTP secret
	 */
	public async readFromClipboard(): Promise<TotpQrResult> {
		const image = await readClipboardImage();
		if (!image || image.isEmpty()) return { status: "error", message: "Copy a screenshot of the QR code first" };

		const { width, height } = image.getSize();
		if (width <= 0 || height <= 0) return { status: "error", message: "Copy a screenshot of the QR code first" };
		if (Math.max(width, height) > MAX_SIDE) return { status: "error", message: "This image is too large to contain a QR code" };

		const scale = Math.min(1, DECODE_SIDE / Math.max(width, height));
		const scaled = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: "good" }) : image;
		const size = scaled.getSize();

		// toBitmap() is BGRA on Windows and Linux: jsQR expects RGBA
		const bgra = scaled.toBitmap();
		const rgba = new Uint8ClampedArray(bgra.length);
		for (let i = 0; i < bgra.length; i += 4) {
			rgba[i] = bgra[i + 2];
			rgba[i + 1] = bgra[i + 1];
			rgba[i + 2] = bgra[i];
			rgba[i + 3] = bgra[i + 3];
		}

		const result = decodeTotpQr(rgba, size.width, size.height);
		this.logger.info(result.status === "success" ? "TOTP read from a QR code in the clipboard" : `TOTP QR code not read: ${result.message}`);
		return result;
	}
}

/**
 * Image of the clipboard (Electron 44 only exposes the asynchronous W3C-style API: PNG blobs)
 */
async function readClipboardImage() {
	for (const item of await clipboard.read()) {
		if (!item.types.includes("image/png")) continue;
		const blob = await item.getType("image/png");
		return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
	}
	return null;
}
