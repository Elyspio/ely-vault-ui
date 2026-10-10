/**
 * Local configuration, stored as JSON in the application folder. It never contains a secret:
 * the Bitwarden CLI keeps its own (encrypted) vault data in a dedicated folder.
 */
export type AppConfig = {
	version: 1;
	security: {
		/** Minutes of system inactivity before the vault locks, null for never */
		autoLockMinutes: number | null;
		/** Seconds before a copied value is cleared from the clipboard, null for never */
		clipboardClearSeconds: number | null;
		/** Locks the vault when the session is locked or the computer goes to sleep */
		lockOnSystemLock: boolean;
	};
	display: {
		/** Fetches website icons through the server's icon service */
		showFavicons: boolean;
	};
	autoType: {
		/** Sequence typed for the items without an "autotype" custom field */
		defaultSequence: string;
		/** Presses Enter after the default sequence (an item's own sequence is typed as is) */
		pressEnter: boolean;
		/** What happens to the window once the sequence is typed */
		afterTyping: AutoTypeAfter;
	};
	updates: {
		/** Checks GitHub for a new release at startup then periodically, and downloads it */
		autoCheck: boolean;
		/** Also installs the prereleases (x.y.z-beta.n) */
		beta: boolean;
	};
	window: {
		bounds: { x: number; y: number; width: number; height: number } | null;
	};
};

export type AutoTypeAfter = "minimized" | "restore" | "lock";

export const defaultAppConfig: AppConfig = {
	version: 1,
	security: {
		autoLockMinutes: 15,
		clipboardClearSeconds: 30,
		lockOnSystemLock: true,
	},
	display: {
		showFavicons: true,
	},
	autoType: {
		defaultSequence: "{USERNAME}{TAB}{PASSWORD}",
		pressEnter: true,
		afterTyping: "minimized",
	},
	updates: {
		autoCheck: true,
		beta: false,
	},
	window: {
		bounds: null,
	},
};
