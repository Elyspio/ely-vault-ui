import { Box, Typography } from "@mui/material";
import type { VaultItem } from "@shared/types/vault.types";
import { EditorSection } from "./EditorSection";

/**
 * SSH key of the item, read-only: replacing a key is not available yet
 */
export function SshKeyInfo({ item }: Readonly<{ item: VaultItem }>) {
	const sshKey = item.sshKey;

	return (
		<EditorSection title="SSH key">
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				<Typography className="mono" sx={{ fontSize: "0.85rem", overflowWrap: "anywhere", color: "var(--text-muted)" }}>
					{sshKey?.keyFingerprint ?? "No fingerprint"}
				</Typography>
				{sshKey?.publicKey && (
					<Typography className="mono" sx={{ fontSize: "0.8rem", overflowWrap: "anywhere", color: "var(--text-muted)" }}>
						{sshKey.publicKey}
					</Typography>
				)}
				<Typography sx={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>
					{sshKey?.hasPrivateKey ? "Private key stored, not shown." : "No private key."} Replacing the key is not available yet.
				</Typography>
			</Box>
		</EditorSection>
	);
}
