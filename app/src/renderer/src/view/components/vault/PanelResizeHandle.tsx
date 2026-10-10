import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Box } from "@mui/material";

type Props = {
	/** Position of the handle, in pixels from the left edge of the vault screen */
	left: number;
	width: number;
	label: string;
	/** Called on every move with the requested width, `done` once the drag (or the key press) is over to save it */
	onResize: (width: number, done: boolean) => void;
	/** Double click: back to the default width */
	onReset: () => void;
};

const keyboardStep = 16;

/**
 * Invisible strip over the right border of a panel: dragging it (or the arrow keys once focused) resizes the panel
 */
export function PanelResizeHandle({ left, width, label, onResize, onReset }: Props) {
	const drag = useRef<{ startX: number; startWidth: number } | null>(null);

	const onPointerDown = (event: PointerEvent<HTMLHRElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { startX: event.clientX, startWidth: width };
	};

	const onPointerMove = (event: PointerEvent<HTMLHRElement>) => {
		if (!drag.current) return;
		onResize(drag.current.startWidth + event.clientX - drag.current.startX, false);
	};

	const onPointerUp = (event: PointerEvent<HTMLHRElement>) => {
		if (!drag.current) return;
		const { startX, startWidth } = drag.current;
		drag.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
		onResize(startWidth + event.clientX - startX, true);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
		const delta = event.key === "ArrowLeft" ? -keyboardStep : event.key === "ArrowRight" ? keyboardStep : 0;
		if (!delta) return;
		event.preventDefault();
		onResize(width + delta, true);
	};

	return (
		<Box
			component="hr"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuenow={width}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onKeyDown={onKeyDown}
			onDoubleClick={onReset}
			sx={{
				position: "absolute",
				m: 0,
				border: 0,
				height: "auto",
				top: 0,
				bottom: 0,
				left: left - 3,
				width: 6,
				zIndex: 2,
				cursor: "col-resize",
				touchAction: "none",
				outline: "none",
				// Thin accent line over the panel border while hovered, dragged or focused
				"&::after": {
					content: '""',
					position: "absolute",
					top: 0,
					bottom: 0,
					left: 2,
					width: 2,
					bgcolor: "primary.main",
					opacity: 0,
					transition: "opacity 120ms ease",
				},
				"&:hover::after, &:active::after, &:focus-visible::after": { opacity: 1 },
			}}
		/>
	);
}
