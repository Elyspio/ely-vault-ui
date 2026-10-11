import { useEffect, useState } from "react";
import { Box, InputBase, Typography } from "@mui/material";
import FolderRounded from "@mui/icons-material/FolderRounded";
import { focusItemList } from "@hooks/useDialogFocus";

type Props = {
	/** Indentation of the row in the tree */
	depth: number;
	initialValue: string;
	placeholder: string;
	helper: string;
	/** Resolves true when the field can close (the write succeeded) */
	onSubmit: (value: string) => Promise<boolean>;
	onCancel: () => void;
};

/**
 * Inline text field of the folder tree (new folder, rename). Enter submits, Escape cancels; an empty or unchanged name cancels.
 * It does not cancel on blur: the menu that starts a rename gives the focus back to its trigger.
 */
export function FolderNameField({ depth, initialValue, placeholder, helper, onSubmit, onCancel }: Readonly<Props>) {
	const [value, setValue] = useState(initialValue);
	const [busy, setBusy] = useState(false);

	// Closing (submit, cancel) gives the focus back to what had it before: the new folder button, or the rename menu item that is gone by then (the item list takes it)
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		return () => {
			const active = document.activeElement;
			if (!active || active === document.body) {
				if (previous && previous !== document.body && previous.isConnected) previous.focus();
				else focusItemList();
			}
		};
	}, []);

	const submit = async () => {
		if (busy) return;
		const trimmed = value.trim();
		if (!trimmed || trimmed === initialValue) {
			onCancel();
			return;
		}

		setBusy(true);
		const done = await onSubmit(trimmed);
		setBusy(false);
		if (done) onCancel();
	};

	return (
		<Box sx={{ pl: 0.25 + depth * 1.5, pr: 1.25, pb: 0.5, mb: 0.25 }}>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1,
					px: 1,
					py: 0.25,
					borderRadius: 1.5,
					border: "1px solid var(--border-medium)",
					bgcolor: "var(--surface-2)",
					color: "text.secondary",
					"& .MuiSvgIcon-root": { fontSize: 17 },
				}}
			>
				<FolderRounded />
				<InputBase
					autoFocus
					fullWidth
					disabled={busy}
					placeholder={placeholder}
					value={value}
					inputProps={{ "aria-label": placeholder }}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							void submit();
						} else if (event.key === "Escape") {
							// Escape closes the field only: the window shortcuts keep their meaning elsewhere
							event.preventDefault();
							event.stopPropagation();
							onCancel();
						}
					}}
					sx={{ fontSize: "0.82rem", color: "text.primary" }}
				/>
			</Box>
			<Typography sx={{ mt: 0.5, px: 0.5, fontSize: "0.7rem", color: "var(--text-faint)" }}>{helper}</Typography>
		</Box>
	);
}
