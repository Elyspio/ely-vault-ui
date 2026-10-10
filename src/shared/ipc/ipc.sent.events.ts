/*************************************************************************************
 * Les événements IPC qui sont envoyés par le process main vers les browserWindow.
 *
 * Attention, on ne peut pas utiliser des types des librairies NodeJS, electron pour IpcSentEvents
 * *************************************************************************************/
import type { IpcMainInvokeEvent } from "electron";
import type { SessionState } from "@shared/types/vault.types";
import type { UpdateStatus } from "@shared/types/update.types";

export type IpcSentEvents = {
	/**
	 * L'état de la session a changé sans action du renderer (verrouillage automatique, veille...)
	 */
	"session:state": (event: IpcMainInvokeEvent, state: SessionState) => void;
	/**
	 * Une valeur copiée a été effacée du presse-papiers
	 */
	"clipboard:cleared": (event: IpcMainInvokeEvent) => void;
	"app:screen:toggle-full-screen": (event: IpcMainInvokeEvent, isMaximized: boolean) => void;
	/**
	 * L'état de la mise à jour automatique a changé
	 */
	"update:status": (event: IpcMainInvokeEvent, status: UpdateStatus) => void;
};
