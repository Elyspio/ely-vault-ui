import { Menu, MenuItem, Tooltip } from "@mui/material";
import DriveFileRenameOutlineRounded from "@mui/icons-material/DriveFileRenameOutlineRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { useTranslation } from "react-i18next";

export type FolderMenuPosition = { top: number; left: number };

type Props = {
	fullName: string;
	position: FolderMenuPosition;
	/** Why the folder cannot be renamed / deleted, null when it can */
	renameBlocker: string | null;
	deleteBlocker: string | null;
	onRename: () => void;
	onDelete: () => void;
	onClose: () => void;
};

/**
 * Context menu of a folder row (right click or the "..." button). A refused action stays visible, dimmed, with its reason as tooltip.
 * The focus is not restored on close: the rename field takes it.
 */
export function FolderMenu({ fullName, position, renameBlocker, deleteBlocker, onRename, onDelete, onClose }: Readonly<Props>) {
	const { t } = useTranslation(["vault", "common"]);
	return (
		<Menu
			open
			onClose={onClose}
			disableRestoreFocus
			anchorReference="anchorPosition"
			anchorPosition={position}
			slotProps={{ paper: { sx: { minWidth: 180, bgcolor: "var(--surface-1)", border: "1px solid var(--border-medium)" } } }}
		>
			<Tooltip title={renameBlocker ?? t("folderMenu.renameTooltip")} placement="right">
				<MenuItem
					aria-disabled={renameBlocker !== null}
					onClick={() => {
						if (renameBlocker === null) onRename();
					}}
					sx={{ fontSize: "0.85rem", gap: 1.25, opacity: renameBlocker ? 0.45 : 1 }}
				>
					<DriveFileRenameOutlineRounded sx={{ fontSize: 17 }} />
					{t("common:rename")}
				</MenuItem>
			</Tooltip>
			<Tooltip title={deleteBlocker ?? t("folderMenu.deleteTooltip", { name: fullName })} placement="right">
				<MenuItem
					aria-disabled={deleteBlocker !== null}
					onClick={() => {
						if (deleteBlocker === null) onDelete();
					}}
					sx={{ fontSize: "0.85rem", gap: 1.25, color: "error.main", opacity: deleteBlocker ? 0.45 : 1 }}
				>
					<DeleteOutlineRounded sx={{ fontSize: 17 }} />
					{t("common:delete")}
				</MenuItem>
			</Tooltip>
		</Menu>
	);
}
