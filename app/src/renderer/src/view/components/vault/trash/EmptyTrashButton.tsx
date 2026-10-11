import { useState } from "react";
import { Button } from "@mui/material";
import DeleteSweepRounded from "@mui/icons-material/DeleteSweepRounded";
import { useAppSelector } from "@store";
import { selectTrashItems } from "@modules/vault/vault.selectors";
import { useVaultWrites } from "@hooks/useVaultWrites";
import { PurgeConfirmDialog } from "./PurgeConfirmDialog";

/**
 * "Empty trash" of the list header: shown with the trash filter when the trash is not empty.
 * Purges every deleted item, not only the ones matching the search.
 */
export function EmptyTrashButton() {
	const filterKind = useAppSelector((state) => state.vault.filter.kind);
	const trash = useAppSelector(selectTrashItems);
	const writes = useVaultWrites();
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);

	if (filterKind !== "trash" || trash.length === 0) return null;

	const confirm = async () => {
		setBusy(true);
		await writes.purgeItems(trash.map((item) => item.id));
		setBusy(false);
		setConfirming(false);
	};

	return (
		<>
			<Button size="small" color="error" variant="outlined" startIcon={<DeleteSweepRounded />} disabled={busy} onClick={() => setConfirming(true)}>
				Empty trash
			</Button>
			<PurgeConfirmDialog
				open={confirming}
				title="Empty the trash?"
				message={`Permanently delete ${trash.length} item${trash.length > 1 ? "s" : ""}? This cannot be undone.`}
				confirmLabel="Empty trash"
				onConfirm={() => void confirm()}
				onClose={() => setConfirming(false)}
			/>
		</>
	);
}
