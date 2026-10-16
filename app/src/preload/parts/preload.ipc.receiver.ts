import { ipcRendererWrapper } from "./preload.ipc.wrapper";
import type { SessionState, VaultSnapshot } from "@shared/types/vault.types";
import type { UpdateStatus } from "@shared/types/update.types";

export function getIpcReceiver() {
	return {
		vault: {
			snapshot: (callback: (snapshot: VaultSnapshot) => void) => ipcRendererWrapper.on("vault:snapshot", callback),
		},
		session: {
			/**
			 * State change without a renderer action (auto-lock, sleep...)
			 */
			state: (callback: (state: SessionState) => void) => ipcRendererWrapper.on("session:state", callback),
		},
		clipboard: {
			cleared: (callback: () => void) => ipcRendererWrapper.on("clipboard:cleared", callback),
		},
		update: {
			status: (callback: (status: UpdateStatus) => void) => ipcRendererWrapper.on("update:status", callback),
		},
		app: {
			screen: {
				toggleFullScreen: (callback: (isMaximized: boolean) => void) => ipcRendererWrapper.on("app:screen:toggle-full-screen", callback),
			},
		},
	};
}

export type PreloadReceivedIpc = ReturnType<typeof getIpcReceiver>;
