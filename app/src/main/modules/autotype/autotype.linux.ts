import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { AutoTypeKey } from "@shared/autotype/autotype.sequence";
import { type AutoTypeDriver, KEY_DELAY_MS } from "./autotype.driver";
import { appMessage } from "@shared/i18n/message";

const execFileAsync = promisify(execFile);

const xdotoolKeys: Record<AutoTypeKey, string> = { tab: "Tab", enter: "Return" };
/** Characters typed per xdotool call: the active window is checked between two batches */
const BATCH_SIZE = 4;
/** Window types never used as a target */
const desktopTypes = ["_NET_WM_WINDOW_TYPE_DESKTOP", "_NET_WM_WINDOW_TYPE_DOCK"];

/**
 * Reason why xdotool cannot be used in this session, null when it can
 */
export async function getXdotoolUnavailableReason(): Promise<string | null> {
	// Under XWayland, DISPLAY is set too, but the other applications are mostly native Wayland
	if (process.env["XDG_SESSION_TYPE"] === "wayland" || process.env["WAYLAND_DISPLAY"]) {
		return appMessage("autoTypeWayland");
	}
	try {
		await execFileAsync("xdotool", ["version"]);
		return null;
	} catch {
		return appMessage("autoTypeInstallXdotool");
	}
}

/**
 * X11 through xdotool. Text goes through stdin: it never appears in a command line
 */
export class LinuxAutoTypeDriver implements AutoTypeDriver {
	public async getForegroundWindow() {
		try {
			const { stdout } = await execFileAsync("xdotool", ["getactivewindow"]);
			const id = stdout.trim();
			if (!/^\d+$/.test(id) || (await isDesktopWindow(id))) return null;
			return id;
		} catch {
			return null;
		}
	}

	public async waitForKeysReleased() {
		// No key state query with xdotool: it releases the modifiers itself (--clearmodifiers)
		return true;
	}

	public async typeText(text: string, check: () => Promise<void>) {
		// Graphemes: a batch never splits a surrogate pair or a combining accent
		const characters = Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment);
		for (let index = 0; index < characters.length; index += BATCH_SIZE) {
			await check();
			await typeBatch(characters.slice(index, index + BATCH_SIZE).join(""));
		}
	}

	public async pressKey(key: AutoTypeKey) {
		await execFileAsync("xdotool", ["key", "--clearmodifiers", xdotoolKeys[key]]);
	}
}

function typeBatch(text: string) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn("xdotool", ["type", "--clearmodifiers", "--delay", String(KEY_DELAY_MS), "--file", "-"], { stdio: ["pipe", "ignore", "ignore"] });
		child.on("error", reject);
		// xdotool may exit before reading (X server gone): EPIPE must not crash the main process
		child.stdin.on("error", (error) => {
			child.kill();
			reject(error);
		});
		child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`xdotool failed (code ${code})`))));
		child.stdin.end(text);
	});
}

/**
 * Desktop and panels, through their EWMH type; xprop is optional
 */
async function isDesktopWindow(id: string) {
	try {
		const { stdout } = await execFileAsync("xprop", ["-id", id, "_NET_WM_WINDOW_TYPE"]);
		return desktopTypes.some((type) => stdout.includes(type));
	} catch {
		return false;
	}
}
