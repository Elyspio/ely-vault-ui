import koffi from "koffi";
import type { AutoTypeKey } from "@shared/autotype/autotype.sequence";
import { type AutoTypeDriver, KEY_DELAY_MS, sleep } from "./autotype.driver";

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x2;
const KEYEVENTF_UNICODE = 0x4;

const virtualKeys: Record<AutoTypeKey, number> = { tab: 0x09, enter: 0x0d };
/** VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN and V: a held V would repeat into the target */
const triggerKeys = [0x10, 0x11, 0x12, 0x5b, 0x5c, 0x56];
/** The desktop and the taskbar are never a target */
const desktopClasses = new Set(["Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd"]);

type KeyboardInput = { type: number; u: { ki: { wVk: number; wScan: number; dwFlags: number; time: number; dwExtraInfo: number } } };

function loadUser32() {
	const user32 = koffi.load("user32.dll");

	const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
		dx: "long",
		dy: "long",
		mouseData: "uint32_t",
		dwFlags: "uint32_t",
		time: "uint32_t",
		dwExtraInfo: "uintptr_t",
	});
	const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
		wVk: "uint16_t",
		wScan: "uint16_t",
		dwFlags: "uint32_t",
		time: "uint32_t",
		dwExtraInfo: "uintptr_t",
	});
	const HARDWAREINPUT = koffi.struct("HARDWAREINPUT", {
		uMsg: "uint32_t",
		wParamL: "uint16_t",
		wParamH: "uint16_t",
	});
	// The union gives INPUT its real size: SendInput rejects a wrong cbSize
	const INPUT = koffi.struct("INPUT", {
		type: "uint32_t",
		u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }),
	});

	return {
		inputSize: koffi.sizeof(INPUT),
		SendInput: user32.func("unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)"),
		GetForegroundWindow: user32.func("uintptr_t __stdcall GetForegroundWindow()"),
		GetClassNameW: user32.func("int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ uint16_t *lpClassName, int nMaxCount)"),
		GetAsyncKeyState: user32.func("int16_t __stdcall GetAsyncKeyState(int vKey)"),
	};
}

function keyboardInput(virtualKey: number, scan: number, flags: number): KeyboardInput {
	return { type: INPUT_KEYBOARD, u: { ki: { wVk: virtualKey, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
}

/**
 * user32 SendInput with KEYEVENTF_UNICODE: characters are typed whatever the keyboard layout (AZERTY, accents...)
 */
export class WindowsAutoTypeDriver implements AutoTypeDriver {
	private readonly api = loadUser32();

	public async getForegroundWindow() {
		const handle = Number(this.api.GetForegroundWindow());
		if (!handle) return null;

		const buffer = new Uint16Array(256);
		const length = this.api.GetClassNameW(handle, buffer, buffer.length) as number;
		const className = String.fromCharCode(...buffer.subarray(0, length));
		return desktopClasses.has(className) ? null : String(handle);
	}

	public async waitForKeysReleased(timeoutMs: number) {
		const deadline = Date.now() + timeoutMs;
		while (triggerKeys.some((key) => (this.api.GetAsyncKeyState(key) as number) & 0x8000)) {
			if (Date.now() > deadline) return false;
			await sleep(25);
		}
		return true;
	}

	public async typeText(text: string, check: () => Promise<void>) {
		for (let index = 0; index < text.length; index++) {
			await check();
			// UTF-16 code units: a surrogate pair is sent as two inputs, which Windows recombines
			const unit = text.charCodeAt(index);
			this.send([keyboardInput(0, unit, KEYEVENTF_UNICODE), keyboardInput(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP)]);
			await sleep(KEY_DELAY_MS);
		}
	}

	public async pressKey(key: AutoTypeKey) {
		const virtualKey = virtualKeys[key];
		this.send([keyboardInput(virtualKey, 0, 0), keyboardInput(virtualKey, 0, KEYEVENTF_KEYUP)]);
		await sleep(KEY_DELAY_MS);
	}

	private send(inputs: KeyboardInput[]) {
		const sent = this.api.SendInput(inputs.length, inputs, this.api.inputSize) as number;
		if (sent !== inputs.length) throw new Error("Saisie bloquée par le système");
	}
}
