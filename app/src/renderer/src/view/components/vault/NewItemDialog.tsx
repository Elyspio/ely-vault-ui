import { type ReactNode, useState } from "react";
import { Box, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import LoginRounded from "@mui/icons-material/LoginRounded";
import StickyNote2Rounded from "@mui/icons-material/StickyNote2Rounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setNewItemOpen } from "@modules/ui/ui.reducer";
import { openEditor } from "@modules/vault/vault.reducer";
import { useHotkeys } from "@hooks/useHotkeys";
import { CipherType } from "@shared/types/vault.types";
import { Kbd } from "@components/shared/Kbd";

type Option = { type: CipherType; label: string; hint: string; key: string; icon: ReactNode };

/** SSH keys are not created yet: they are not offered */
const options: Option[] = [
	{ type: CipherType.Login, label: "Login", hint: "Username, password, websites", key: "l", icon: <LoginRounded /> },
	{ type: CipherType.SecureNote, label: "Secure note", hint: "Free text", key: "n", icon: <StickyNote2Rounded /> },
	{ type: CipherType.Card, label: "Card", hint: "Payment card", key: "c", icon: <CreditCardRounded /> },
	{ type: CipherType.Identity, label: "Identity", hint: "Name, address, contact", key: "i", icon: <BadgeRounded /> },
];

/**
 * Type picker opened by Ctrl+N: a letter, or the arrows and Enter, picks the type. Escape closes it (Dialog).
 */
export function NewItemDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.newItemOpen);
	const close = () => dispatch(setNewItemOpen(false));

	return (
		<Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
			{/* Mounted on each opening: the highlight starts on the first type */}
			{open && <TypePicker />}
		</Dialog>
	);
}

function TypePicker() {
	const dispatch = useAppDispatch();
	const [index, setIndex] = useState(0);

	const pick = (option: Option) => {
		dispatch(setNewItemOpen(false));
		dispatch(openEditor({ mode: "create", type: option.type }));
	};

	// Window level, like the other shortcuts: the dialog has no field, so a letter never reaches a text input
	useHotkeys([
		...options.map((option) => ({ combo: option.key, handler: () => pick(option) })),
		{ combo: "arrowdown", handler: () => setIndex((current) => Math.min(current + 1, options.length - 1)) },
		{ combo: "arrowup", handler: () => setIndex((current) => Math.max(current - 1, 0)) },
		{ combo: "enter", handler: () => pick(options[index]) },
	]);

	return (
		<>
			<DialogTitle>New item</DialogTitle>
			<DialogContent sx={{ p: 1 }}>
				{options.map((option, i) => (
					<Box
						key={option.type}
						component="button"
						type="button"
						onMouseMove={() => setIndex(i)}
						onClick={() => pick(option)}
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							px: 1.5,
							py: 1,
							borderRadius: 2,
							cursor: "pointer",
							width: "100%",
							border: "none",
							font: "inherit",
							color: "inherit",
							textAlign: "left",
							bgcolor: i === index ? "var(--surface-3)" : "transparent",
						}}
					>
						<Box sx={{ width: 30, height: 30, display: "grid", placeItems: "center", color: "var(--text-muted)", "& .MuiSvgIcon-root": { fontSize: 18 } }}>
							{option.icon}
						</Box>
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{option.label}</Typography>
							<Typography sx={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{option.hint}</Typography>
						</Box>
						<Kbd>{option.key.toUpperCase()}</Kbd>
					</Box>
				))}
			</DialogContent>
		</>
	);
}
