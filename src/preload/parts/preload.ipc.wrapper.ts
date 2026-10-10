import { ipcRenderer } from "electron";
import type { IpcHandledEvents } from "@shared/ipc/ipc.handled.events";
import type { IpcSentEvents } from "@shared/ipc/ipc.sent.events";

export type SkipFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

export const ipcRendererWrapper = {
	invoke<Channel extends keyof IpcHandledEvents>(
		channel: Channel,
		...args: SkipFirst<Parameters<IpcHandledEvents[Channel]>>
	): Promise<Awaited<ReturnType<IpcHandledEvents[Channel]>>> {
		return ipcRenderer.invoke(channel, ...args);
	},

	/**
	 * Adds a listener and returns a function to remove it
	 */
	on<Channel extends keyof IpcSentEvents>(channel: Channel, listener: (...args: SkipFirst<Parameters<IpcSentEvents[Channel]>>) => void) {
		const wrapped = (_: unknown, ...args: unknown[]) => listener(...(args as SkipFirst<Parameters<IpcSentEvents[Channel]>>));
		ipcRenderer.on(channel, wrapped);
		return () => {
			ipcRenderer.removeListener(channel, wrapped);
		};
	},
};
