import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import type { TotpCode } from "@shared/types/vault.types";
import { useVaultActions } from "@hooks/useVaultActions";
import { FieldRow } from "./FieldRow";

/**
 * Live TOTP code with its countdown. Protected items wait for an explicit click (master password reprompt).
 */
export function TotpRow({ itemId, reprompt }: Readonly<{ itemId: string; reprompt: boolean }>) {
	const actions = useVaultActions();
	const [enabled, setEnabled] = useState(!reprompt);
	const [totp, setTotp] = useState<TotpCode | null>(null);
	const [remaining, setRemaining] = useState(0);

	useEffect(() => {
		if (!enabled) return;
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const refresh = async () => {
			const code = await actions.totp(itemId);
			if (!active) return;
			if (!code) {
				setEnabled(false);
				return;
			}
			setTotp(code);
			setRemaining(code.remaining);
			timer = setTimeout(() => void refresh(), code.remaining * 1000 + 50);
		};

		void refresh();
		const ticker = setInterval(() => setRemaining((r) => Math.max(r - 1, 0)), 1000);

		return () => {
			active = false;
			clearTimeout(timer);
			clearInterval(ticker);
		};
	}, [enabled, itemId, actions]);

	const formatted = totp ? `${totp.code.slice(0, Math.ceil(totp.code.length / 2))} ${totp.code.slice(Math.ceil(totp.code.length / 2))}` : "••• •••";
	const urgent = remaining <= 5;

	return (
		<FieldRow
			label="Verification code (TOTP)"
			onCopy={() => void actions.copy(itemId, { kind: "totp" }, "Code")}
			actions={
				!enabled && (
					<Button size="small" onClick={() => setEnabled(true)}>
						Show
					</Button>
				)
			}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
				<Typography
					className="mono"
					sx={{
						fontSize: "1.25rem",
						fontWeight: 500,
						letterSpacing: "0.08em",
						color: enabled && totp ? (urgent ? "warning.main" : "text.primary") : "var(--text-muted)",
					}}
				>
					{formatted}
				</Typography>
				{enabled && totp && (
					<Box sx={{ position: "relative", display: "inline-flex" }}>
						<CircularProgress variant="determinate" value={100} size={22} thickness={4} sx={{ color: "var(--surface-3)", position: "absolute" }} />
						<CircularProgress variant="determinate" value={(remaining / totp.period) * 100} size={22} thickness={4} color={urgent ? "warning" : "primary"} />
						<Typography sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "0.6rem", color: "var(--text-muted)" }}>
							{remaining}
						</Typography>
					</Box>
				)}
			</Box>
		</FieldRow>
	);
}
