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
		/** Releases followed: stable only, also the betas (x.y.z-beta.n), or the development builds (x.y.z-dev.n) */
		channel: UpdateChannel;
	};
	window: {
		bounds: { x: number; y: number; width: number; height: number } | null;
	};
};

export type AutoTypeAfter = "minimized" | "restore" | "lock";

export type UpdateChannel = "stable" | "beta" | "dev";

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
		channel: "stable",
	},
	window: {
		bounds: null,
	},
};

/**
 * Channel of an installed version: a beta (x.y.z-beta.n) or development build (x.y.z-dev.n) follows its own releases
 */
export function channelOfVersion(version: string): UpdateChannel {
	const prerelease = /^\d+\.\d+\.\d+-(beta|dev)\./.exec(version)?.[1];
	return prerelease === "beta" || prerelease === "dev" ? prerelease : "stable";
}

/**
 * Update settings of a saved configuration. Earlier versions stored a `beta` switch instead of the channel;
 * without any, the channel of the installed version is used (a development build starts on the Dev channel).
 */
export function readUpdateSettings(saved: (Partial<AppConfig["updates"]> & { beta?: boolean }) | undefined, currentVersion: string): AppConfig["updates"] {
	const { beta, ...settings } = saved ?? {};
	const channel = beta === undefined ? channelOfVersion(currentVersion) : beta ? "beta" : "stable";
	return { ...defaultAppConfig.updates, channel, ...settings };
}
