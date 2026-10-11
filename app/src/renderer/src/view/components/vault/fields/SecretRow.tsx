import { useState } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import type { SecretRef } from "@shared/types/vault.types";
import { useVaultActions } from "@hooks/useVaultActions";
import { FieldRow } from "./FieldRow";
import { useTranslation } from "react-i18next";

type Props = {
	label: string;
	itemId: string;
	secret: SecretRef;
	/** Shown instead of dots while hidden, ex: "•••• 1111" */
	maskedHint?: string;
	multiline?: boolean;
	colored?: boolean;
};

/**
 * A secret value: hidden by default, fetched from the main process only when revealed
 */
export function SecretRow({ label, itemId, secret, maskedHint, multiline, colored = true }: Readonly<Props>) {
	const actions = useVaultActions();
	const { t } = useTranslation();
	const [value, setValue] = useState<string | null>(null);

	const toggle = async () => {
		if (value !== null) {
			setValue(null);
			return;
		}
		setValue(await actions.reveal(itemId, secret));
	};

	return (
		<FieldRow
			label={label}
			mono
			multiline={multiline && value !== null}
			onCopy={() => void actions.copy(itemId, secret, label)}
			actions={
				<Tooltip title={value === null ? t("show") : t("hide")}>
					<IconButton size="small" onClick={() => void toggle()}>
						{value === null ? <VisibilityRounded sx={{ fontSize: 16 }} /> : <VisibilityOffRounded sx={{ fontSize: 16 }} />}
					</IconButton>
				</Tooltip>
			}
		>
			{value === null ? (
				<Box component="span" sx={{ letterSpacing: maskedHint ? undefined : "0.12em", color: "var(--text-muted)" }}>
					{maskedHint ?? "••••••••••••"}
				</Box>
			) : colored && !multiline ? (
				<ColoredSecret value={value} />
			) : (
				value
			)}
		</FieldRow>
	);
}

/**
 * Digits and symbols colored differently, to read a password without ambiguity
 */
export function ColoredSecret({ value }: Readonly<{ value: string }>) {
	return (
		<>
			{Array.from(value).map((char, index) => (
				<Box key={index} component="span" sx={{ color: /\d/.test(char) ? "primary.main" : /[^\p{L}\p{N}]/u.test(char) ? "warning.main" : undefined }}>
					{char}
				</Box>
			))}
		</>
	);
}
