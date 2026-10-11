import { translateMessage } from "./message.utils";

/** Error thrown by the main process, without the "Error invoking remote method" wrapper */
function ipcErrorText(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/^Error invoking remote method '[^']+':\s*/, "").replace(/^\w*Error:\s*/, "");
}

/**
 * Message of an error thrown by the main process, in the current language
 */
export function ipcErrorMessage(error: unknown): string {
	return translateMessage(ipcErrorText(error));
}

/** The item needs the master password again before showing a secret */
export function isRepromptRequired(error: unknown) {
	return ipcErrorText(error) === "REPROMPT_REQUIRED";
}
