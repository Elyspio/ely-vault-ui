import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, IconButton, Stack, Tooltip } from "@mui/material";
import CloudOffRounded from "@mui/icons-material/CloudOffRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { syncVault } from "@modules/vault/vault.async.actions";
import { webContainer } from "@core/di/web.container";
import { SessionService } from "@services/session.service";
import { formatRelative } from "@view/utils/date.utils";

/**
 * Takes the place of the sync button while the vault server does not answer: the details are in the tooltip,
 * a click syncs again (vault open) or checks the server again (locked)
 */
export function ServerStatusButton({ sx }: { sx: Record<string, unknown> }) {
	const dispatch = useAppDispatch();
	const { t } = useTranslation("auth");
	const { t: settings } = useTranslation("settings");
	const session = useAppSelector((state) => state.session.current);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync ?? state.session.current?.lastSync ?? null);
	const syncing = useAppSelector((state) => state.vault.syncing);
	const [now, setNow] = useState(() => Date.now());

	// The remaining offline time goes down while the tooltip can be shown
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(timer);
	}, []);

	const unlocked = session?.status === "unlocked";
	const host = session?.serverUrl ? new URL(session.serverUrl).host : "";
	const remainingMinutes = session?.offlineAccessUntil ? Math.ceil((session.offlineAccessUntil - now) / 60_000) : 0;
	const lines = [
		t("titlebar.server.unreachable", { host }),
		lastSync ? t("titlebar.server.lastSync", { lastSync: formatRelative(lastSync) }) : null,
		remainingMinutes > 0
			? t("titlebar.server.offlineLeft", {
					duration:
						remainingMinutes >= 60
							? settings("durations.hours", { count: Math.floor(remainingMinutes / 60) })
							: settings("durations.minutes", { count: remainingMinutes }),
				})
			: t("titlebar.server.offlineExpired"),
		t("titlebar.server.retry"),
	].filter((line) => line !== null);

	return (
		<Tooltip
			title={
				<Stack spacing={0.5} sx={{ py: 0.5 }}>
					{lines.map((line) => (
						<span key={line}>{line}</span>
					))}
				</Stack>
			}
		>
			<IconButton
				aria-label={lines[0]}
				sx={{ ...sx, color: "warning.main", "&:hover": { color: "warning.light" } }}
				disabled={syncing}
				onClick={() => (unlocked ? void dispatch(syncVault()) : void webContainer.get(SessionService).checkServer())}
			>
				<Badge variant="dot" color="warning" overlap="circular">
					<CloudOffRounded sx={{ fontSize: 17 }} />
				</Badge>
			</IconButton>
		</Tooltip>
	);
}
