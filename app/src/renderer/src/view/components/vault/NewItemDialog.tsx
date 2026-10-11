import { type ReactNode, type RefObject, useRef, useState } from "react";
import { Box, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import LoginRounded from "@mui/icons-material/LoginRounded";
import StickyNote2Rounded from "@mui/icons-material/StickyNote2Rounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@store";
import { setNewItemOpen } from "@modules/ui/ui.reducer";
import { openEditor } from "@modules/vault/vault.reducer";
import { useHotkeys } from "@hooks/useHotkeys";
import { CipherType } from "@shared/types/vault.types";
import { Kbd } from "@components/shared/Kbd";
import { useDialogFocus } from "@hooks/useDialogFocus";
import { cipherTypeKeys } from "./editor/EditorHeader";

/** Label and hint in `editor:types` / `editor:newItem.hints` (key of the type in {@link cipherTypeKeys}) */
type Option = { type: CipherType; key: string; icon: ReactNode };

const options: Option[] = [
	{ type: CipherType.Login, key: "l", icon: <LoginRounded /> },
	{ type: CipherType.SecureNote, key: "n", icon: <StickyNote2Rounded /> },
	{ type: CipherType.Card, key: "c", icon: <CreditCardRounded /> },
	{ type: CipherType.Identity, key: "i", icon: <BadgeRounded /> },
	{ type: CipherType.SshKey, key: "s", icon: <KeyRounded /> },
];

/**
 * Type picker opened by Ctrl+N: a letter, or the arrows and Enter, picks the type. Escape closes it (Dialog).
 */
export function NewItemDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.newItemOpen);
	const close = () => dispatch(setNewItemOpen(false));
	// No field: the first type is the main action
	const firstRef = useRef<HTMLButtonElement>(null);
	const focus = useDialogFocus(() => firstRef.current);

	return (
		<Dialog open={open} onClose={close} maxWidth="xs" fullWidth slotProps={{ transition: focus }}>
			{/* Mounted on each opening: the highlight starts on the first type */}
			{open && <TypePicker firstRef={firstRef} />}
		</Dialog>
	);
}

function TypePicker({ firstRef }: Readonly<{ firstRef: RefObject<HTMLButtonElement | null> }>) {
	const { t } = useTranslation("editor");
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
			<DialogTitle>{t("newItem.title")}</DialogTitle>
			<DialogContent sx={{ p: 1 }}>
				{options.map((option, i) => (
					<Box
						key={option.type}
						ref={i === 0 ? firstRef : undefined}
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
							<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{t(`types.${cipherTypeKeys[option.type]}`)}</Typography>
							<Typography sx={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{t(`newItem.hints.${cipherTypeKeys[option.type]}`)}</Typography>
						</Box>
						<Kbd>{option.key.toUpperCase()}</Kbd>
					</Box>
				))}
			</DialogContent>
		</>
	);
}
