import type { Translation } from "../i18n.types";
import type { auth as en } from "../en/auth";

export const auth: Translation<typeof en> = {
	app: {
		fatalErrorTitle: "Impossible de démarrer le client Bitwarden",
	},
	login: {
		title: "Se connecter",
		subtitle: "Connectez-vous à votre serveur Vaultwarden ou Bitwarden",
		footer: "Le mot de passe principal ne quitte jamais cet ordinateur : le coffre est déchiffré localement.",
		serverLabel: "Serveur",
		emailLabel: "Adresse e-mail",
		masterPasswordLabel: "Mot de passe principal",
		submit: "Se connecter",
		pending: "Connexion et déchiffrement…",
		backToLogin: "Retour à la connexion",
	},
	twoFactor: {
		title: "Authentification en deux étapes",
		subtitle: "Saisissez le code de vérification pour {{email}}",
		methodLabel: "Méthode",
		codeLabel: "Code",
		methods: {
			authenticator: "Application d'authentification",
			email: "Code envoyé par e-mail",
			yubikey: "YubiKey (OTP)",
		},
		verify: "Vérifier",
		sendEmail: "Envoyer le code par e-mail",
	},
	sso: {
		title: "Connexion SSO",
		subtitle: "Ce serveur exige l'authentification de votre organisation pour {{email}}",
		description:
			"La page de connexion de votre organisation s'ouvre dans le navigateur. Une fois authentifié, revenez ici : le mot de passe principal saisi déchiffre le coffre sur cet ordinateur.",
		continue: "Continuer avec SSO",
		pending: "Terminez la connexion dans le navigateur…",
	},
	certificate: {
		title: "Certificat non reconnu",
		subtitle: "Cet ordinateur ne fait pas confiance au certificat présenté par le serveur",
		server: "Serveur",
		chain: "Chaîne",
		validUntil: "Certificat du serveur valide jusqu'au",
		rootToApprove: "Autorité racine à approuver",
		certificateToApprove: "Certificat à approuver",
		fingerprint: "Empreinte SHA-256",
		compareHint:
			"Comparez cette empreinte avec celle fournie par l'administrateur du serveur. Approuver un certificat inconnu permettrait à un tiers d'intercepter la connexion.",
		checked: "J'ai vérifié l'empreinte",
		importHint: "Importez le certificat de l'autorité racine de votre organisation (fichier .crt, .cer ou .pem) pour approuver ce serveur.",
		importAuthority: "Importer une autorité…",
		approve: "Approuver et continuer",
	},
	unlock: {
		title: "Coffre verrouillé",
		masterPasswordLabel: "Mot de passe principal",
		submit: "Déverrouiller",
		pending: "Déchiffrement…",
		withHello: "Déverrouiller avec Windows Hello",
		logout: "Se déconnecter ou changer de compte",
		access: {
			offlineExpired: {
				label: "Accès hors ligne expiré",
				details: {
					window: "Hors ligne, le coffre s’ouvre pendant {{duration}} après la dernière synchronisation.",
					fix: "Connectez-vous au serveur, puis déverrouillez.",
					setting: "Durée : Paramètres → Sécurité → Accès hors ligne",
				},
			},
			authenticationRequired: {
				label: "Authentification refusée",
				details: {
					reason: "Le serveur a refusé votre authentification.",
					fix: "Déconnectez-vous, puis reconnectez-vous en ligne.",
				},
			},
		},
	},
	hello: {
		title: "Déverrouiller avec Windows Hello ?",
		description:
			"La prochaine fois, déverrouillez le coffre avec votre visage, votre empreinte digitale ou votre code PIN au lieu du mot de passe principal. Votre mot de passe principal est stocké chiffré pour votre compte Windows. Vous pouvez modifier ce choix dans Paramètres → Sécurité.",
		decline: "Non merci",
		accept: "Utiliser Windows Hello",
		enabled: "Déverrouillage Windows Hello activé",
	},
	titlebar: {
		search: "Rechercher et copier…",
		generator: "Générateur de mots de passe (Ctrl G)",
		sync: "Synchroniser (F5)",
		syncWithLast: "Synchroniser (F5) · {{lastSync}}",
		lock: "Verrouiller (Ctrl L)",
		settings: "Paramètres (Ctrl ,)",
		olderVersionAvailable: "Version antérieure {{version}} disponible",
		versionReady: "Version {{version}} prête à installer",
		olderThanInstalled: "Antérieure à la version installée ({{version}})",
		restarts: "Redémarre l'application",
		updateTo: "Mettre à jour vers {{version}}",
		goBackTo: "Revenir à {{version}}",
		server: {
			unreachable: "Serveur du coffre injoignable ({{host}})",
			lastSync: "Dernière synchronisation {{lastSync}}",
			offlineLeft: "Accès hors ligne encore {{duration}}",
			offlineExpired: "Accès hors ligne expiré",
			retry: "Cliquer pour réessayer",
		},
	},
};
