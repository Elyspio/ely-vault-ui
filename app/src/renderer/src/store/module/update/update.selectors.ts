import type { StoreState } from "@store";

/**
 * Update waiting for the user: ready to install, or a stable release to go back to from a beta
 */
export function selectPendingUpdate(state: StoreState) {
	const status = state.update.status;
	if (status?.state === "downloaded" || (status?.state === "available" && status.downgrade)) return status;
	return null;
}
