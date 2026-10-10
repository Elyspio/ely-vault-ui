import { clipboard, ClipboardItem } from "electron";
import { inject, injectable, LazyServiceIdentifier } from "inversify";
import { LogModule } from "../log.module";
import { ConfigModule } from "../config/config.module";
import { IpcModule } from "../ipc.module";

/**
 * Raw Windows clipboard formats that keep a copied value out of the clipboard history (Win+V) and the cloud clipboard.
 * See https://learn.microsoft.com/windows/win32/dataxchg/clipboard-formats#cloud-clipboard-and-clipboard-history-formats
 */
const windowsPrivacyFormats = ["ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"];

/**
 * Copies values and clears them from the clipboard after the configured delay, if they are still there.
 */
@injectable()
export class ClipboardModule extends LogModule {
	private lastCopied: string | null = null;
	private clearTimer: NodeJS.Timeout | null = null;

	public constructor(
		@inject(ConfigModule) private readonly configModule: ConfigModule,
		@inject(new LazyServiceIdentifier(() => IpcModule)) private readonly ipcModule: IpcModule
	) {
		super("ClipboardModule");
	}

	public async copy(value: string) {
		await this.write(value);
		this.lastCopied = value;

		if (this.clearTimer) clearTimeout(this.clearTimer);
		this.clearTimer = null;

		const { clipboardClearSeconds } = (await this.configModule.getConfig()).security;
		if (clipboardClearSeconds) {
			this.clearTimer = setTimeout(() => void this.clearIfOwned(), clipboardClearSeconds * 1000);
		}
	}

	/**
	 * Clears the clipboard when it still holds the last copied value (the user may have copied something else since)
	 */
	public async clearIfOwned() {
		if (this.clearTimer) clearTimeout(this.clearTimer);
		this.clearTimer = null;

		const lastCopied = this.lastCopied;
		this.lastCopied = null;

		if (lastCopied !== null && (await clipboard.readText()) === lastCopied) {
			clipboard.clear();
			this.ipcModule.sendToMainWindow("clipboard:cleared");
			this.logger.debug("Clipboard cleared");
		}
	}

	private async write(value: string) {
		if (process.platform !== "win32") {
			await clipboard.writeText(value);
			return;
		}

		try {
			// A DWORD 0 for the "Can..." formats, any content for the "Exclude..." one
			const zero = new Blob([new Uint8Array(4)]);
			const formats = Object.fromEntries(windowsPrivacyFormats.map((format) => [`electron application/osclipboard;format="${format}"`, zero]));
			await clipboard.write([new ClipboardItem({ "text/plain": value, ...formats })]);
		} catch (error) {
			this.logger.warn("Private clipboard formats unavailable, plain copy", error instanceof Error ? error.message : error);
			await clipboard.writeText(value);
		}
	}
}
