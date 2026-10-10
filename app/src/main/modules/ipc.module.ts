import { BrowserWindow } from "electron";
import { injectable } from "inversify";
import { LogModule } from "./log.module";
import type { SkipFirst } from "@preload/parts/preload.ipc.wrapper";
import type { IpcSentEvents } from "@shared/ipc/ipc.sent.events";

@injectable()
export class IpcModule extends LogModule {
	public constructor() {
		super("IpcModule");
	}

	/**
	 * Sends an IPC message to the main window, if there is one
	 */
	public sendToMainWindow<Channel extends keyof IpcSentEvents>(channel: Channel, ...args: SkipFirst<Parameters<IpcSentEvents[Channel]>>) {
		const window = BrowserWindow.getAllWindows()[0];
		if (!window || window.isDestroyed()) return;
		window.webContents.send(channel, ...args);
	}
}
