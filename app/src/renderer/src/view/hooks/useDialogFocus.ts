import { useEffect, useMemo, useState } from "react";

/**
 * The item list (ItemList): the tabbable box around the rows. Empty list: nothing to focus.
 */
export function focusItemList() {
	const row = document.querySelector<HTMLElement>("[data-id]");
	row?.closest<HTMLElement>('[tabindex="0"]')?.focus();
}

/**
 * Keyboard focus of a Dialog opened by a shortcut or a button.
 *
 * - Focus goes to `getTarget()` once the opening transition has ended, every time the dialog opens. A focus set earlier
 *   (autoFocus, or on mount) is overridden: MUI's FocusTrap focuses the dialog container when it opens.
 * - `ready` false keeps the focus pending (a button still disabled while its content loads); it is taken when ready becomes true.
 * - When the dialog has closed and MUI could not give the focus back (the element was removed, e.g. a deleted item), the item list takes it.
 *
 * Spread the result into `slotProps.transition` of the Dialog.
 */
export function useDialogFocus(getTarget: () => HTMLElement | null | undefined, ready = true) {
	const [entered, setEntered] = useState(false);

	useEffect(() => {
		if (entered && ready) getTarget()?.focus();
		// Only when the dialog opens or the target becomes ready: the user may move the focus afterwards
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entered, ready]);

	return useMemo(
		() => ({
			onEntered: () => setEntered(true),
			onExited: () => {
				setEntered(false);
				const active = document.activeElement;
				if (!active || active === document.body) focusItemList();
			},
		}),
		[]
	);
}
