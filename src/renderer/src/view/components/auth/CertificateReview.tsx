import { useState } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Stack, Typography } from "@mui/material";
import GppMaybeRounded from "@mui/icons-material/GppMaybeRounded";
import FileUploadRounded from "@mui/icons-material/FileUploadRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { importAuthority, trustCertificate } from "@modules/session/session.async.actions";
import { dismissCertificate } from "@modules/session/session.reducer";
import type { CertificateInfo } from "@shared/types/certificate.types";
import type { LoginRequest } from "@shared/types/vault.types";
import { formatDateTime } from "@view/utils/date.utils";

type Props = { certificate: CertificateInfo; request: LoginRequest };

/**
 * Certificate refused by the system: details, SHA-256 fingerprint to check, and explicit approval
 */
export function CertificateReview({ certificate, request }: Readonly<Props>) {
	const dispatch = useAppDispatch();
	const { pending, error } = useAppSelector((state) => state.session);
	const [checked, setChecked] = useState(false);

	return (
		<Stack spacing={2}>
			<Alert severity="warning" variant="outlined" icon={<GppMaybeRounded />}>
				{certificate.reason}
			</Alert>

			<Box sx={{ borderRadius: 2, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-0)", px: 2, py: 1.5, display: "grid", gap: 1 }}>
				<Detail label="Serveur" value={certificate.host} />
				<Detail label="Chaîne" value={certificate.chain.join("  →  ")} />
				<Detail label="Certificat du serveur valide jusqu'au" value={formatDateTime(certificate.validTo)} />
				{certificate.trustable && (
					<>
						<Detail label={certificate.chain.length > 1 ? "Autorité racine à approuver" : "Certificat à approuver"} value={certificate.anchor.subject} />
						<Box>
							<Typography sx={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>Empreinte SHA-256</Typography>
							<Typography className="mono" sx={{ fontSize: "0.78rem", lineHeight: 1.6, overflowWrap: "anywhere", userSelect: "text" }}>
								{certificate.anchor.fingerprint256}
							</Typography>
						</Box>
					</>
				)}
			</Box>

			{certificate.trustable ? (
				<>
					<Typography variant="body2" sx={{ color: "text.secondary" }}>
						Comparez cette empreinte avec celle communiquée par l'administrateur du serveur. Approuver un certificat inconnu permettrait à un intermédiaire
						d'intercepter la connexion.
					</Typography>
					<FormControlLabel
						control={<Checkbox size="small" checked={checked} onChange={(_, value) => setChecked(value)} />}
						label={<Typography variant="body2">J'ai vérifié l'empreinte</Typography>}
					/>
				</>
			) : (
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					Importez le certificat de l'autorité racine de votre organisation (fichier .crt, .cer ou .pem) pour approuver ce serveur.
				</Typography>
			)}

			{error && (
				<Alert severity="error" variant="outlined">
					{error}
				</Alert>
			)}

			<Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
				<Button color="inherit" disabled={pending} onClick={() => dispatch(dismissCertificate())}>
					Annuler
				</Button>
				<Button
					variant={certificate.trustable ? "text" : "contained"}
					disabled={pending}
					startIcon={<FileUploadRounded />}
					onClick={() => void dispatch(importAuthority(request))}
				>
					Importer une autorité…
				</Button>
				{certificate.trustable && (
					<Button
						variant="contained"
						disabled={!checked || pending}
						startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
						onClick={() => void dispatch(trustCertificate({ fingerprint256: certificate.anchor.fingerprint256, request }))}
					>
						Approuver et continuer
					</Button>
				)}
			</Box>
		</Stack>
	);
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
	return (
		<Box>
			<Typography sx={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>{label}</Typography>
			<Typography sx={{ fontSize: "0.85rem", overflowWrap: "anywhere" }}>{value}</Typography>
		</Box>
	);
}
