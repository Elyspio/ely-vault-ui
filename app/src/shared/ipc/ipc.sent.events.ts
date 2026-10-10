/*************************************************************************************
 * IPC events sent by the main process to the browser windows.
 *
 * IpcSentEvents cannot use types of the Node.js or Electron libraries
 * *************************************************************************************/
import type { IpcMainInvokeEvent } from "electron";
import type { SessionState } from "@shared/types/vault.types";
import type { UpdateStatus } from "@shared/types/update.types";

export type IpcSentEvents = {
	/**
	 * The session state changed without a renderer action (auto-lock, sleep...)
	 */
	"session:state": (event: IpcMainInvokeEvent, state: SessionState) => void;
	/**
	 * A copied value was cleared from the clipboard
	 */
	"clipboard:cleared": (event: IpcMainInvokeEvent) => void;
	"app:screen:toggle-full-screen": (event: IpcMainInvokeEvent, isMaximized: boolean) => void;
	/**
	 * The auto update state changed
	 */
	"update:status": (event: IpcMainInvokeEvent, status: UpdateStatus) => void;
};
