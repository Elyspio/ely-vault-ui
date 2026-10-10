import type { ReactNode } from "react";
import { Avatar, Box, ButtonBase, Typography } from "@mui/material";
import AppsRounded from "@mui/icons-material/AppsRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import StickyNote2Rounded from "@mui/icons-material/StickyNote2Rounded";
import VpnKeyRounded from "@mui/icons-material/VpnKeyRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import FolderOffRounded from "@mui/icons-material/FolderOffRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import CollectionsBookmarkRounded from "@mui/icons-material/CollectionsBookmarkRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectCounts } from "@modules/vault/vault.selectors";
import { setFilter } from "@modules/vault/vault.reducer";
import type { VaultFilter } from "@modules/vault/vault.search";
import { setSettingsOpen } from "@modules/ui/ui.reducer";
import { CipherType } from "@shared/types/vault.types";

export const typeLabels: Record<CipherType, string> = {
	[CipherType.Login]: "Identifiants",
	[CipherType.Card]: "Cartes",
	[CipherType.Identity]: "Identités",
	[CipherType.SecureNote]: "Notes",
	[CipherType.SshKey]: "Clés SSH",
};

const typeIcons: Record<CipherType, ReactNode> = {
	[CipherType.Login]: <LanguageRounded />,
	[CipherType.Card]: <CreditCardRounded />,
	[CipherType.Identity]: <BadgeRounded />,
	[CipherType.SecureNote]: <StickyNote2Rounded />,
	[CipherType.SshKey]: <VpnKeyRounded />,
};

const typeOrder = [CipherType.Login, CipherType.Card, CipherType.Identity, CipherType.SecureNote, CipherType.SshKey];

function sameFilter(a: VaultFilter, b: VaultFilter) {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function Sidebar() {
	const dispatch = useAppDispatch();
	const filter = useAppSelector((state) => state.vault.filter);
	const snapshot = useAppSelector((state) => state.vault.snapshot);
	const counts = useAppSelector(selectCounts);
	const account = useAppSelector((state) => state.session.current);

	const entry = (target: VaultFilter, icon: ReactNode, label: string, count: number) => (
		<SidebarEntry key={JSON.stringify(target)} icon={icon} label={label} count={count} active={sameFilter(filter, target)} onClick={() => dispatch(setFilter(target))} />
	);

	const folders = (snapshot?.folders ?? []).toSorted((a, b) => a.name.localeCompare(b.name, "fr"));

	return (
		<Box component="nav" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--surface-0)", borderRight: "1px solid var(--border-subtle)" }}>
			<Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1.5 }}>
				{entry({ kind: "all" }, <AppsRounded />, "Tous les éléments", counts.all)}
				{entry({ kind: "favorites" }, <StarRounded />, "Favoris", counts.favorites)}

				<SectionTitle>Types</SectionTitle>
				{typeOrder.filter((type) => counts.types[type] > 0).map((type) => entry({ kind: "type", type }, typeIcons[type], typeLabels[type], counts.types[type]))}

				{(folders.length > 0 || counts.noFolder > 0) && <SectionTitle>Dossiers</SectionTitle>}
				{folders.map((folder) => entry({ kind: "folder", id: folder.id }, <FolderRounded />, folder.name, counts.folders[folder.id] ?? 0))}
				{counts.noFolder > 0 && entry({ kind: "folder", id: null }, <FolderOffRounded />, "Sans dossier", counts.noFolder)}

				{(snapshot?.organizations.length ?? 0) > 0 && <SectionTitle>Organisations</SectionTitle>}
				{snapshot?.organizations.map((organization) => (
					<Box key={organization.id}>
						{entry({ kind: "organization", id: organization.id }, <BusinessRounded />, organization.name, counts.organizations[organization.id] ?? 0)}
						<Box sx={{ pl: 1.5 }}>
							{snapshot.collections
								.filter((collection) => collection.organizationId === organization.id)
								.map((collection) =>
									entry({ kind: "collection", id: collection.id }, <CollectionsBookmarkRounded />, collection.name, counts.collections[collection.id] ?? 0)
								)}
						</Box>
					</Box>
				))}
			</Box>

			<ButtonBase
				onClick={() => dispatch(setSettingsOpen(true))}
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1.25,
					px: 1.75,
					py: 1.25,
					borderTop: "1px solid var(--border-subtle)",
					justifyContent: "flex-start",
					textAlign: "left",
					"&:hover": { bgcolor: "var(--surface-1)" },
				}}
			>
				<Avatar sx={{ width: 28, height: 28, fontSize: "0.8rem", fontWeight: 600, bgcolor: "var(--accent-soft)", color: "primary.main" }}>
					{account?.email?.[0]?.toUpperCase()}
				</Avatar>
				<Box sx={{ minWidth: 0 }}>
					<Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
						{account?.email}
					</Typography>
					<Typography noWrap sx={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>
						{account?.serverUrl ? new URL(account.serverUrl).host : ""}
					</Typography>
				</Box>
			</ButtonBase>
		</Box>
	);
}

function SectionTitle({ children }: Readonly<{ children: string }>) {
	return (
		<Typography variant="overline" component="div" sx={{ px: 1.25, pt: 2, pb: 0.25, color: "var(--text-faint)" }}>
			{children}
		</Typography>
	);
}

type EntryProps = { icon: ReactNode; label: string; count: number; active: boolean; onClick: () => void };

function SidebarEntry({ icon, label, count, active, onClick }: Readonly<EntryProps>) {
	return (
		<ButtonBase
			onClick={onClick}
			sx={{
				width: "100%",
				display: "flex",
				alignItems: "center",
				gap: 1.25,
				px: 1.25,
				py: 0.7,
				mb: 0.25,
				borderRadius: 1.5,
				justifyContent: "flex-start",
				color: active ? "primary.main" : "text.secondary",
				bgcolor: active ? "var(--accent-soft)" : "transparent",
				transition: "background-color 120ms ease, color 120ms ease",
				"&:hover": { bgcolor: active ? "var(--accent-soft)" : "var(--surface-2)", color: active ? "primary.main" : "text.primary" },
				"& .MuiSvgIcon-root": { fontSize: 17 },
			}}
		>
			{icon}
			<Typography noWrap sx={{ flex: 1, fontSize: "0.82rem", fontWeight: active ? 600 : 500, textAlign: "left" }}>
				{label}
			</Typography>
			<Typography sx={{ fontSize: "0.72rem", color: active ? "primary.main" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{count}</Typography>
		</ButtonBase>
	);
}
