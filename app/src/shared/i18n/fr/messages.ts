import type { Translation } from "../i18n.types";
import type { messages as en } from "../en/messages";

export const messages: Translation<typeof en> = {
	// Session
	vaultLocked: "Le coffre est verrouillé",
	invalidServerAddress: "Adresse du serveur invalide (https:// requis)",
	serverUnreachable: "Serveur injoignable",
	serverUnreachableDetail: "Serveur injoignable : {{detail}}",
	ssoCancelled: "Connexion SSO annulée ou expirée",
	incorrectCredentials: "Adresse e-mail ou mot de passe incorrect",
	incorrectMasterPassword: "Mot de passe principal incorrect",
	invalidVerificationCode: "Code de vérification invalide",
	certificateNotRecognized: "Certificat du serveur non reconnu : approuvez son autorité dans les paramètres",

	// Windows Hello
	unlockFirst: "Déverrouillez d'abord le coffre",
	enableHelloFromSettings: "Activez Windows Hello depuis les paramètres",
	helloNotEnabled: "Le déverrouillage par Windows Hello n'est pas activé pour ce compte",
	helloNoLongerValid: "Le déverrouillage par Windows Hello n'est plus valide, déverrouillez avec le mot de passe principal",
	helloPasswordChanged: "Le mot de passe principal a changé, déverrouillez avec celui-ci pour réactiver Windows Hello",

	// Items and folders
	itemNotFound: "Élément introuvable",
	itemNotInTrash: "Élément introuvable dans la corbeille",
	noItemSelected: "Aucun élément sélectionné",
	nameRequired: "Le nom est obligatoire",
	itemTypeNotEditable: "Ce type d'élément ne peut pas être modifié",
	itemTypeCannotChange: "Le type de l'élément ne peut pas changer",
	restoreBeforeEditing: "Restaurez l'élément avant de le modifier",
	unsupportedItemType: "Type d'élément non pris en charge",
	sshKeyRequired: "Une clé SSH est requise : générez, importez ou collez-en une",
	linkedFieldCannotBeCreated: "Les champs liés ne peuvent pas être créés",
	customFieldMissing: "Un champ personnalisé fait référence à un champ inexistant",
	customFieldDuplicated: "Un champ personnalisé apparaît plusieurs fois",
	linkedFieldKeepsType: "Les champs liés gardent leur type",
	invalidTotpSecret: "Clé TOTP invalide",
	folderNotFound: "Dossier introuvable",
	folderNameEmpty: "Le nom du dossier est vide",
	newFolderNameEmpty: "Le nouveau nom du dossier est vide",
	folderNameUnchanged: "Le nouveau nom est identique à l'actuel",
	folderExists: "Un dossier porte déjà ce nom",
	noFolderUnder: "Aucun dossier sous « {{path}} »",
	folderHasItems: "Déplacez ou supprimez d'abord ses éléments",
	folderHasSubFolders: "Supprimez d'abord ses sous-dossiers",

	// SSH keys
	sshKeyExpired: "La clé SSH a expiré, générez-la ou importez-la de nouveau",
	sshImportExpired: "La clé a expiré, importez-la de nouveau",
	sshKeyTooLarge: "Trop volumineux pour être une clé SSH",
	sshPassphraseRequired: "Cette clé est protégée par une phrase secrète",
	sshWrongPassphrase: "Phrase secrète incorrecte",
	sshDsaUnsupported: "Les clés DSA ne sont pas prises en charge : utilisez une clé Ed25519, RSA ou ECDSA",
	sshPublicKey: "Ceci est une clé publique : choisissez ou collez la clé privée",
	sshInvalidFormat: "Ce n'est pas une clé privée : format OpenSSH, PEM ou PKCS#8 attendu",
	sshUnsupportedType: "Type de clé non pris en charge : {{type}}",

	// TOTP QR code
	qrScreenshotRequired: "Copiez d'abord une capture d'écran du QR code",
	qrImageTooLarge: "Cette image est trop grande pour contenir un QR code",
	qrInvalidImage: "L'image n'est pas valide",
	qrNotFound: "Aucun QR code trouvé dans l'image",
	qrNotTotp: "Ce QR code n'est pas une clé TOTP",

	// Auto-type
	autoTypeInProgress: "Saisie automatique déjà en cours",
	autoTypeNeedsLogin: "La saisie automatique nécessite un identifiant avec un nom d'utilisateur ou un mot de passe",
	autoTypeUnsafeCharacters: "Saisie impossible : le nom d'utilisateur ou le mot de passe contient une tabulation ou un saut de ligne",
	autoTypeNoTarget: "Aucune fenêtre cible : la saisie automatique tape dans la fenêtre ouverte avant {{app}}",
	autoTypeReleaseKeys: "Saisie automatique annulée : relâchez Ctrl, Shift, Alt et V",
	autoTypeLocked: "Saisie automatique interrompue : le coffre a été verrouillé",
	autoTypeWindowChanged: "Saisie automatique interrompue : la fenêtre active a changé",
	autoTypeUnavailable: "La saisie automatique n'est pas disponible sur ce système",
	autoTypeModuleNotFound: "Saisie automatique indisponible : module système introuvable",
	autoTypeBlocked: "Saisie bloquée par le système",
	autoTypeWayland: "Indisponible sous Wayland : il bloque la saisie de touches dans les autres applications",
	autoTypeInstallXdotool: "Installez xdotool pour utiliser la saisie automatique",

	// Auto-type sequences
	sequenceControlCharacter: "Caractère de contrôle à la position {{position}} : utilisez {TAB} ou {ENTER}",
	sequenceUnclosedBrace: "Accolade non fermée à la position {{position}}",
	sequenceDelayTooLong: "Délai trop long : {{code}} ({{max}} ms au maximum)",
	sequenceUnknownCode: "Code inconnu : {{code}}",
	sequenceInvalidItem: "Séquence « {{field}} » de l'élément invalide (position {{position}})",
	sequenceInvalidDefault: "Séquence par défaut invalide : {{detail}}",

	// Certificates
	certificateUnknown: "Certificat inconnu : reconnectez-vous",
	certificateStillNotTrusted: "Le serveur n'est toujours pas approuvé : {{detail}}",
	certificateNoneInFile: "Aucun certificat dans ce fichier",
	certificateNotAuthority: "« {{name}} » n'est pas un certificat d'autorité",
	certificateWrongHost: "Le certificat n'est pas émis pour {{host}}",
	certificateChainInvalid: "Un certificat de la chaîne a expiré ou n'est pas encore valide",
	certificateRootNotFound: "Autorité racine introuvable : importez son certificat",
	certificateSelfSigned: "Certificat auto-signé",
	certificateAuthorityUnknown: "Autorité « {{name}} » inconnue de cet ordinateur",
};
