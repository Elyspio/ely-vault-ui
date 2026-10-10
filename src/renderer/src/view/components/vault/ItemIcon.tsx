import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import StickyNote2Rounded from "@mui/icons-material/StickyNote2Rounded";
import VpnKeyRounded from "@mui/icons-material/VpnKeyRounded";
import { CipherType, type VaultItem } from "@shared/types/vault.types";
import { useAppSelector } from "@store";
import { webContainer } from "@core/di/web.container";
import { VaultService } from "@services/vault.service";

const tints = ["#4fd2ff", "#a78bfa", "#3ddc97", "#ffb454", "#ff7eb6", "#7aa2ff", "#f97316", "#2dd4bf"];

function tintOf(name: string) {
	let hash = 0;
	for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
	return tints[Math.abs(hash) % tints.length];
}

const typeIcons: Partial<Record<CipherType, typeof CreditCardRounded>> = {
	[CipherType.Card]: CreditCardRounded,
	[CipherType.Identity]: BadgeRounded,
	[CipherType.SecureNote]: StickyNote2Rounded,
	[CipherType.SshKey]: VpnKeyRounded,
};

function useFavicon(host: string | null | undefined) {
	const enabled = useAppSelector((state) => state.config.current.display.showFavicons);
	const [loaded, setLoaded] = useState<{ host: string; icon: string | null } | null>(null);

	useEffect(() => {
		if (!enabled || !host) return;
		let active = true;
		void webContainer
			.get(VaultService)
			.icon(host)
			.then((icon) => active && setLoaded({ host, icon }));
		return () => {
			active = false;
		};
	}, [enabled, host]);

	return enabled && loaded && loaded.host === host ? loaded.icon : null;
}

/**
 * Favicon of the first website of a login, or a tinted type icon / initial
 */
export function ItemIcon({ item, size = 32 }: Readonly<{ item: VaultItem; size?: number }>) {
	const favicon = useFavicon(item.login?.uris[0]?.host);
	const tint = tintOf(item.name);
	const Icon = typeIcons[item.type];

	return (
		<Box
			sx={{
				width: size,
				height: size,
				flexShrink: 0,
				borderRadius: size > 40 ? 3 : 2,
				display: "grid",
				placeItems: "center",
				overflow: "hidden",
				bgcolor: favicon ? "rgba(255,255,255,0.92)" : `${tint}1f`,
				border: "1px solid",
				borderColor: favicon ? "transparent" : `${tint}33`,
				color: tint,
				fontWeight: 600,
				fontSize: size * 0.42,
				userSelect: "none",
			}}
		>
			{favicon ? (
				<Box component="img" src={favicon} alt="" sx={{ width: size * 0.62, height: size * 0.62, objectFit: "contain" }} />
			) : Icon ? (
				<Icon sx={{ fontSize: size * 0.55 }} />
			) : (
				(item.name.trim()[0] ?? "?").toUpperCase()
			)}
		</Box>
	);
}
