import type { Translation } from "../i18n.types";
import type { main as en } from "../en/main";

export const main: Translation<typeof en> = {
	importAuthorityTitle: "Importer un certificat d'autorité",
	certificatesFilter: "Certificats",
	importSshKeyTitle: "Importer une clé privée SSH",
	allFilesFilter: "Tous les fichiers",
};
