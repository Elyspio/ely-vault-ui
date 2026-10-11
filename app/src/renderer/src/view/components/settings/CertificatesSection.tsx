import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import FileUploadRounded from "@mui/icons-material/FileUploadRounded";
import { useAppDispatch } from "@store";
import { showToast } from "@modules/ui/ui.reducer";
import { webContainer } from "@core/di/web.container";
import { CertificateService } from "@services/certificate.service";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import type { TrustedCertificate } from "@shared/types/certificate.types";
import { formatDateTime } from "@view/utils/date.utils";

/**
 * Authorities approved in the application (private PKI, self-signed servers)
 */
export function CertificatesSection() {
	const { t } = useTranslation("settings");
	const dispatch = useAppDispatch();
	const [certificates, setCertificates] = useState<TrustedCertificate[]>([]);
	const service = webContainer.get(CertificateService);

	const refresh = useCallback(async () => setCertificates(await service.list()), [service]);

	useEffect(() => {
		void service.list().then(setCertificates);
	}, [service]);

	const run = async (action: () => Promise<unknown>, success: string) => {
		try {
			await action();
			dispatch(showToast(success));
		} catch (error) {
			dispatch(showToast(ipcErrorMessage(error), "error"));
		}
		await refresh();
	};

	return (
		<>
			{certificates.map((certificate) => (
				<Box key={certificate.fingerprint256} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderBottom: "1px solid var(--border-subtle)" }}>
					<VerifiedUserRounded sx={{ fontSize: 18, color: "success.main" }} />
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography sx={{ fontSize: "0.85rem", fontWeight: 500 }}>{certificate.subject}</Typography>
						<Typography sx={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
							{t("certificates.expiresOn", {
								origin: certificate.host ? t("certificates.approvedFor", { host: certificate.host }) : t("certificates.imported"),
								date: formatDateTime(certificate.validTo),
							})}
						</Typography>
						<Typography className="mono" noWrap sx={{ fontSize: "0.66rem", color: "var(--text-faint)" }}>
							{certificate.fingerprint256}
						</Typography>
					</Box>
					<Tooltip title={t("certificates.remove")}>
						<IconButton
							size="small"
							aria-label={t("certificates.remove")}
							onClick={() => void run(() => service.remove(certificate.fingerprint256), t("certificates.removed", { subject: certificate.subject }))}
						>
							<DeleteOutlineRounded fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
			))}
			<Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, py: 1.5 }}>
				<Box sx={{ flex: 1 }}>
					<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{certificates.length ? t("certificates.add") : t("certificates.none")}</Typography>
					<Typography sx={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("certificates.hint")}</Typography>
				</Box>
				<Button
					size="small"
					variant="outlined"
					startIcon={<FileUploadRounded />}
					onClick={() =>
						void run(async () => {
							const imported = await service.import();
							if (imported.length === 0) throw new Error(t("certificates.importCancelled"));
						}, t("certificates.importSuccess"))
					}
				>
					{t("certificates.import")}
				</Button>
			</Box>
		</>
	);
}
