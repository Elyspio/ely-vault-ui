import { ipcRendererWrapper } from "./preload.ipc.wrapper";
import type { SessionState } from "@shared/types/vault.types";

export function getIpcReceiver() {
	return {
		session: {
			/**
			 * Changement d'état sans action du renderer (verrouillage automatique, veille...)
			 */
			state: (callback: (state: SessionState) => void) => ipcRendererWrapper.on("session:state", callback),
		},
		clipboard: {
			cleared: (callback: () => void) => ipcRendererWrapper.on("clipboard:cleared", callback),
		},
		app: {
			screen: {
				toggleFullScreen: (callback: (isMaximized: boolean) => void) => ipcRendererWrapper.on("app:screen:toggle-full-screen", callback),
			},
		},
	};
}

export type PreloadReceivedIpc = ReturnType<typeof getIpcReceiver>;
