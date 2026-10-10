import type { AutoTypeKey } from "@shared/autotype/autotype.sequence";

/** Pause between two typed keys, KeePass default */
export const KEY_DELAY_MS = 10;

/**
 * Keyboard injection and foreground window lookup, per platform
 */
export interface AutoTypeDriver {
	/** Id of the foreground window, null when there is none or it is the desktop */
	getForegroundWindow(): Promise<string | null>;
	/** Waits until Ctrl, Shift, Alt, Win and V are released (the Ctrl+V that started auto-type), false after the timeout */
	waitForKeysReleased(timeoutMs: number): Promise<boolean>;
	/** Types the text, calling `check` (which throws to stop) before each character or small batch */
	typeText(text: string, check: () => Promise<void>): Promise<void>;
	pressKey(key: AutoTypeKey): Promise<void>;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
