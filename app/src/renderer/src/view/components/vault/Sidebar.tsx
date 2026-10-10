import { useMemo, useState, type ReactNode } from "react";
import { Avatar, Box, ButtonBase, Typography } from "@mui/material";
import AppsRounded from "@mui/icons-material/AppsRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import StickyNote2Rounded from "@mui/icons-material/StickyNote2Rounded";
import VpnKeyRounded from "@mui/icons-material/VpnKeyRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import FolderOffRounded from "@mui/icons-material/FolderOffRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import CollectionsBookmarkRounded from "@mui/icons-material/CollectionsBookmarkRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectCounts } from "@modules/vault/vault.selectors";
import { setFilter } from "@modules/vault/vault.reducer";
import type { VaultFilter } from "@modules/vault/vault.search";
import { buildFolderTree, countFolderTree, type FolderNode } from "@modules/vault/vault.folders";
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

	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

	const entry = (target: VaultFilter, icon: ReactNode, label: string, count: number) => (
		<SidebarEntry key={JSON.stringify(target)} icon={icon} label={label} count={count} active={sameFilter(filter, target)} onClick={() => dispatch(setFilter(target))} />
	);

	const folders = useMemo(() => buildFolderTree(snapshot?.folders ?? []), [snapshot?.folders]);

	const toggleFolder = (path: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (!next.delete(path)) next.add(path);
			return next;
		});

	const folderEntry = (node: FolderNode, depth: number): ReactNode => {
		const expanded = !collapsed.has(node.path);
		const hasChildren = node.children.length > 0;
		const target: VaultFilter | null = node.id ? { kind: "folder", id: node.id } : null;
		// Collapsed or virtual folder: the count includes the subfolders
		const count = node.id && (expanded || !hasChildren) ? (counts.folders[node.id] ?? 0) : countFolderTree(node, counts.folders);

		return (
			<Box key={node.path}>
				<SidebarEntry
					icon={hasChildren && expanded ? <FolderOpenRounded /> : <FolderRounded />}
					label={node.name}
					count={count}
					depth={depth}
					expanded={hasChildren ? expanded : undefined}
					onToggle={() => toggleFolder(node.path)}
					active={target !== null && sameFilter(filter, target)}
					onClick={() => (target ? dispatch(setFilter(target)) : toggleFolder(node.path))}
				/>
				{hasChildren && expanded && node.children.map((child) => folderEntry(child, depth + 1))}
			</Box>
		);
	};

	return (
		<Box component="nav" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--surface-0)", borderRight: "1px solid var(--border-subtle)" }}>
			<Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1.5 }}>
				{entry({ kind: "all" }, <AppsRounded />, "Tous les éléments", counts.all)}
				{entry({ kind: "favorites" }, <StarRounded />, "Favoris", counts.favorites)}

				<SectionTitle>Types</SectionTitle>
				{typeOrder.filter((type) => counts.types[type] > 0).map((type) => entry({ kind: "type", type }, typeIcons[type], typeLabels[type], counts.types[type]))}

				{(folders.length > 0 || counts.noFolder > 0) && <SectionTitle>Dossiers</SectionTitle>}
				{folders.map((node) => folderEntry(node, 0))}
				{counts.noFolder > 0 && (
					<SidebarEntry
						icon={<FolderOffRounded />}
						label="Sans dossier"
						count={counts.noFolder}
						depth={0}
						active={sameFilter(filter, { kind: "folder", id: null })}
						onClick={() => dispatch(setFilter({ kind: "folder", id: null }))}
					/>
				)}

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

type EntryProps = {
	icon: ReactNode;
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
	/** Level in the folder tree */
	depth?: number;
	/** Defined for tree nodes with children: shows a chevron */
	expanded?: boolean;
	onToggle?: () => void;
};

function SidebarEntry({ icon, label, count, active, onClick, depth, expanded, onToggle }: Readonly<EntryProps>) {
	const inTree = depth !== undefined;

	return (
		<ButtonBase
			onClick={onClick}
			sx={{
				width: "100%",
				display: "flex",
				alignItems: "center",
				gap: 1.25,
				pl: inTree ? 0.25 + depth * 1.5 : 1.25,
				pr: 1.25,
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
			{inTree && (
				<Box
					component="span"
					aria-hidden
					onClick={(event) => {
						if (expanded === undefined) return;
						event.stopPropagation();
						onToggle?.();
					}}
					sx={{
						display: "flex",
						mr: -0.75,
						borderRadius: 1,
						visibility: expanded === undefined ? "hidden" : "visible",
						"&:hover": { color: "text.primary" },
						"& .MuiSvgIcon-root": { fontSize: 16, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 120ms ease" },
					}}
				>
					<ChevronRightRounded />
				</Box>
			)}
			{icon}
			<Typography noWrap sx={{ flex: 1, fontSize: "0.82rem", fontWeight: active ? 600 : 500, textAlign: "left" }}>
				{label}
			</Typography>
			<Typography sx={{ fontSize: "0.72rem", color: active ? "primary.main" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{count}</Typography>
		</ButtonBase>
	);
}
