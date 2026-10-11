import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar, Box, ButtonBase, IconButton, Tooltip, Typography } from "@mui/material";
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
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectCounts } from "@modules/vault/vault.selectors";
import { setFilter } from "@modules/vault/vault.reducer";
import type { VaultFilter } from "@modules/vault/vault.search";
import { buildFolderTree, countFolderTree, folderDeleteBlocker, folderRenameBlocker, normalizeFolderPath, type FolderNode } from "@modules/vault/vault.folders";
import { setFolderPromptOpen, setSettingsOpen } from "@modules/ui/ui.reducer";
import { useFolderCommands } from "@hooks/useFolderCommands";
import { CipherType } from "@shared/types/vault.types";
import { PurgeConfirmDialog } from "./trash/PurgeConfirmDialog";
import { FolderMenu, type FolderMenuPosition } from "./folders/FolderMenu";
import { FolderNameField } from "./folders/FolderNameField";

export const typeLabels: Record<CipherType, string> = {
	[CipherType.Login]: "Logins",
	[CipherType.Card]: "Cards",
	[CipherType.Identity]: "Identities",
	[CipherType.SecureNote]: "Notes",
	[CipherType.SshKey]: "SSH keys",
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
	const folderCommands = useFolderCommands();

	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	// Inline fields and menus of the folder tree
	const [creating, setCreating] = useState(false);
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [menu, setMenu] = useState<{ node: FolderNode; position: FolderMenuPosition } | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);

	// The item shortcuts wait while the folder menu or its confirmation is open (Delete must not reach the item behind)
	useEffect(() => {
		dispatch(setFolderPromptOpen(menu !== null || deleteOpen));
		return () => {
			dispatch(setFolderPromptOpen(false));
		};
	}, [dispatch, menu, deleteOpen]);

	const entry = (target: VaultFilter, icon: ReactNode, label: string, count: number) => (
		<SidebarEntry key={JSON.stringify(target)} icon={icon} label={label} count={count} active={sameFilter(filter, target)} onClick={() => dispatch(setFilter(target))} />
	);

	const folders = useMemo(() => buildFolderTree(snapshot?.folders ?? []), [snapshot?.folders]);
	const activeItemsIn = (node: FolderNode) => (node.id ? (counts.folders[node.id] ?? 0) : 0);

	const toggleFolder = (path: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (!next.delete(path)) next.add(path);
			return next;
		});

	const folderEntry = (node: FolderNode, depth: number): ReactNode => {
		if (renamingPath === node.path) {
			return (
				<FolderNameField
					key={node.path}
					depth={depth}
					initialValue={node.fullName}
					placeholder="Rename folder"
					helper="Sub folders follow the new name. Enter to rename, Esc to cancel."
					onCancel={() => setRenamingPath(null)}
					onSubmit={async (value) => {
						// Same path once normalized ("Work / Projects" for "Work/Projects"): nothing to write
						if (normalizeFolderPath(value) === node.fullName) return true;
						const outcome = await folderCommands.rename(node.fullName, value);
						if (outcome?.status === "success") setRenamingPath(null);
						return outcome?.status === "success";
					}}
				/>
			);
		}

		const expanded = !collapsed.has(node.path);
		const hasChildren = node.children.length > 0;
		const target: VaultFilter | null = node.id ? { kind: "folder", id: node.id } : null;
		const active = target !== null && sameFilter(filter, target);
		// Collapsed or virtual folder: the count includes the subfolders
		const count = node.id && (expanded || !hasChildren) ? (counts.folders[node.id] ?? 0) : countFolderTree(node, counts.folders);
		const openMenu = (position: FolderMenuPosition) => setMenu({ node, position });

		return (
			<Box key={node.path}>
				<SidebarEntry
					icon={hasChildren && expanded ? <FolderOpenRounded /> : <FolderRounded />}
					label={node.name}
					count={count}
					depth={depth}
					expanded={hasChildren ? expanded : undefined}
					onToggle={() => toggleFolder(node.path)}
					active={active}
					onClick={() => (target ? dispatch(setFilter(target)) : toggleFolder(node.path))}
					onContextMenu={(event) => {
						event.preventDefault();
						openMenu({ top: event.clientY, left: event.clientX });
					}}
					trailing={
						<Tooltip title="Rename or delete" placement="right">
							<IconButton
								className="entry-more"
								size="small"
								aria-label={`Actions for ${node.fullName}`}
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									openMenu({ top: rect.bottom, left: rect.left });
								}}
								sx={{
									mr: 0.5,
									p: 0.25,
									opacity: active ? 1 : 0,
									color: "var(--text-faint)",
									"&:hover": { color: "text.primary", bgcolor: "transparent" },
									"&:focus-visible": { opacity: 1 },
									"& .MuiSvgIcon-root": { fontSize: 17 },
								}}
							>
								<MoreHorizRounded />
							</IconButton>
						</Tooltip>
					}
				/>
				{hasChildren && expanded && node.children.map((child) => folderEntry(child, depth + 1))}
			</Box>
		);
	};

	return (
		<Box component="nav" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--surface-0)", borderRight: "1px solid var(--border-subtle)" }}>
			<Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1.5 }}>
				{entry({ kind: "all" }, <AppsRounded />, "All items", counts.all)}
				{entry({ kind: "favorites" }, <StarRounded />, "Favorites", counts.favorites)}

				<SectionTitle>Types</SectionTitle>
				{typeOrder.filter((type) => counts.types[type] > 0).map((type) => entry({ kind: "type", type }, typeIcons[type], typeLabels[type], counts.types[type]))}

				<SectionTitle
					action={
						<Tooltip title="New folder">
							<IconButton
								size="small"
								aria-label="New folder"
								onClick={() => setCreating(true)}
								sx={{ mr: -0.5, color: "var(--text-faint)", "&:hover": { color: "text.primary" }, "& .MuiSvgIcon-root": { fontSize: 16 } }}
							>
								<AddRounded />
							</IconButton>
						</Tooltip>
					}
				>
					Folders
				</SectionTitle>
				{creating && (
					<FolderNameField
						depth={0}
						initialValue=""
						placeholder="New folder"
						helper="Use Parent/Child for a sub folder. Enter to create, Esc to cancel."
						onCancel={() => setCreating(false)}
						onSubmit={async (value) => {
							const outcome = await folderCommands.create(value);
							if (outcome?.status === "success") setCreating(false);
							return outcome?.status === "success";
						}}
					/>
				)}
				{folders.map((node) => folderEntry(node, 0))}
				{counts.noFolder > 0 && (
					<SidebarEntry
						icon={<FolderOffRounded />}
						label="No folder"
						count={counts.noFolder}
						depth={0}
						active={sameFilter(filter, { kind: "folder", id: null })}
						onClick={() => dispatch(setFilter({ kind: "folder", id: null }))}
					/>
				)}

				{(snapshot?.organizations.length ?? 0) > 0 && <SectionTitle>Organizations</SectionTitle>}
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

			<Box sx={{ px: 1, pt: 1, borderTop: "1px solid var(--border-subtle)" }}>{entry({ kind: "trash" }, <DeleteRounded />, "Trash", counts.trash)}</Box>

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

			{menu && (
				<FolderMenu
					fullName={menu.node.fullName}
					position={menu.position}
					renameBlocker={folderRenameBlocker(menu.node)}
					deleteBlocker={folderDeleteBlocker(menu.node, activeItemsIn(menu.node))}
					onRename={() => {
						setRenamingPath(menu.node.path);
						setMenu(null);
					}}
					onDelete={() => {
						const { id, fullName } = menu.node;
						setMenu(null);
						if (!id) return;
						setDeleteTarget({ id, fullName });
						setDeleteOpen(true);
					}}
					onClose={() => setMenu(null)}
				/>
			)}

			<PurgeConfirmDialog
				open={deleteOpen}
				title={`Delete the folder "${deleteTarget?.fullName ?? ""}"?`}
				message="Items in the trash that are in it move to No folder."
				confirmLabel="Delete folder"
				onConfirm={() => {
					setDeleteOpen(false);
					if (deleteTarget) void folderCommands.remove(deleteTarget.id, deleteTarget.fullName);
				}}
				onClose={() => setDeleteOpen(false)}
			/>
		</Box>
	);
}

function SectionTitle({ children, action }: Readonly<{ children: string; action?: ReactNode }>) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", pt: 2, pb: 0.25, pr: 0.5 }}>
			<Typography variant="overline" component="div" sx={{ flex: 1, px: 1.25, color: "var(--text-faint)" }}>
				{children}
			</Typography>
			{action}
		</Box>
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
	/** Button shown at the right of the row, hidden until the row is hovered (or focused) */
	trailing?: ReactNode;
	onContextMenu?: (event: React.MouseEvent) => void;
};

function SidebarEntry({ icon, label, count, active, onClick, depth, expanded, onToggle, trailing, onContextMenu }: Readonly<EntryProps>) {
	const inTree = depth !== undefined;

	return (
		<Box onContextMenu={onContextMenu} sx={{ display: "flex", alignItems: "center", mb: 0.25, "&:hover .entry-more": { opacity: 1 } }}>
			<ButtonBase
				onClick={onClick}
				sx={{
					flex: 1,
					minWidth: 0,
					display: "flex",
					alignItems: "center",
					gap: 1.25,
					pl: inTree ? 0.25 + depth * 1.5 : 1.25,
					pr: 1.25,
					py: 0.7,
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
			{trailing}
		</Box>
	);
}
