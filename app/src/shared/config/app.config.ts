/**
 * Local configuration, stored as JSON in the application folder. It never contains a secret:
 * the Bitwarden CLI keeps its own (encrypted) vault data in a dedicated folder.
 */
import type { LanguageSetting } from "../i18n/i18n.languages";

export type AppConfig = {
	version: 1;
	security: {
		/** Minutes of system inactivity before the vault locks, null for never */
		autoLockMinutes: number | null;
		/** Seconds before a copied value is cleared from the clipboard, null for never */
		clipboardClearSeconds: number | null;
		/** Locks the vault when the session is locked or the computer goes to sleep */
		lockOnSystemLock: boolean;
		/**
		 * Minutes the cached vault stays usable without a successful online sync. Only set in the configuration file;
		 * values above 24 hours (1440) are lowered to 24 hours, values below 1 minute raised to 1 minute.
		 */
		offlineAccessMinutes: number;
	};
	display: {
		/** Fetches website icons through the server's icon service */
		showFavicons: boolean;
		/** Colors of the application: "system" follows the operating system */
		theme: ThemeMode;
		/** Language of the interface: "system" follows the operating system, English when its language is not supported */
		language: LanguageSetting;
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
	layout: PanelLayout;
	window: {
		bounds: { x: number; y: number; width: number; height: number } | null;
	};
};

/** Widths in pixels of the vault panels, resized by dragging their right edge (the item detail takes the rest) */
export type PanelLayout = {
	sidebarWidth: number;
	listWidth: number;
};

export type AutoTypeAfter = "minimized" | "restore" | "lock";

export type UpdateChannel = "stable" | "beta" | "dev";

export type ThemeMode = "dark" | "light" | "system";

export const defaultAppConfig: AppConfig = {
	version: 1,
	security: {
		autoLockMinutes: 15,
		clipboardClearSeconds: 30,
		lockOnSystemLock: true,
		offlineAccessMinutes: 24 * 60,
	},
	display: {
		showFavicons: true,
		theme: "dark",
		language: "system",
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
	layout: {
		sidebarWidth: 264,
		listWidth: 380,
	},
	window: {
		bounds: null,
	},
};

/** Offline access window in milliseconds: never longer than 24 hours, whatever the configuration says */
export function offlineAccessMs(minutes: unknown): number {
	const max = defaultAppConfig.security.offlineAccessMinutes;
	const value = typeof minutes === "number" && Number.isFinite(minutes) ? Math.min(max, Math.max(1, minutes)) : max;
	return value * 60_000;
}

export const panelWidthLimits = {
	sidebar: { min: 200, max: 440 },
	list: { min: 280, max: 640 },
	/** Room always left to the item detail while resizing */
	detailMin: 360,
};

/**
 * Keeps the panel widths within their limits; with the width of the vault screen, also leaves room for the item detail
 * (the sidebar gives way first when the list is resized, and the other way around)
 */
export function clampPanelLayout(layout: PanelLayout, resized: keyof PanelLayout = "listWidth", availableWidth?: number): PanelLayout {
	const clamp = (value: number, min: number, max: number) => Math.round(Math.min(Math.max(value, min), Math.max(min, max)));
	const { sidebar, list, detailMin } = panelWidthLimits;
	const room = (availableWidth ?? Number.POSITIVE_INFINITY) - detailMin;

	if (resized === "sidebarWidth") {
		const sidebarWidth = clamp(layout.sidebarWidth, sidebar.min, Math.min(sidebar.max, room - list.min));
		return { sidebarWidth, listWidth: clamp(layout.listWidth, list.min, Math.min(list.max, room - sidebarWidth)) };
	}

	const listWidth = clamp(layout.listWidth, list.min, Math.min(list.max, room - sidebar.min));
	return { sidebarWidth: clamp(layout.sidebarWidth, sidebar.min, Math.min(sidebar.max, room - listWidth)), listWidth };
}

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
