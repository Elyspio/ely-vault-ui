/**
 * Message of an error thrown by the main process, without the "Error invoking remote method" wrapper
 */
export function ipcErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/^Error invoking remote method '[^']+':\s*/, "").replace(/^\w*Error:\s*/, "");
}

/** The item needs the master password again before showing a secret */
export function isRepromptRequired(error: unknown) {
	return ipcErrorMessage(error) === "REPROMPT_REQUIRED";
}
