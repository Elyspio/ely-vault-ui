import { useEffect, useEffectEvent } from "react";

type Hotkey = {
	/** Ex: "ctrl+k", "ctrl+shift+c", "f5" ("ctrl" also matches cmd on macOS) */
	combo: string;
	handler: (event: KeyboardEvent) => void;
	/** Also fires while typing in a field */
	allowInInput?: boolean;
};

function matches(event: KeyboardEvent, combo: string) {
	const parts = combo.toLowerCase().split("+");
	const key = parts.at(-1)!;
	const ctrl = parts.includes("ctrl");
	const shift = parts.includes("shift");
	const alt = parts.includes("alt");
	const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();

	return eventKey === key && (event.ctrlKey || event.metaKey) === ctrl && event.shiftKey === shift && event.altKey === alt;
}

function isTyping(event: KeyboardEvent) {
	const target = event.target as HTMLElement | null;
	return !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Window-level keyboard shortcuts
 */
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		for (const hotkey of hotkeys) {
			if (matches(event, hotkey.combo) && (hotkey.allowInInput || !isTyping(event))) {
				event.preventDefault();
				hotkey.handler(event);
				return;
			}
		}
	});

	useEffect(() => {
		if (!enabled) return;

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}
