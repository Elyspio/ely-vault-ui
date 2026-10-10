import type { IpcMainInvokeEvent } from "electron";
import type { AppConfig } from "@shared/config/app.config";
import type { TrustedCertificate } from "@shared/types/certificate.types";
import type { UpdateStatus } from "@shared/types/update.types";
import type {
	AutoTypeAvailability,
	CopyRef,
	LoginRequest,
	LoginResult,
	PasswordGeneratorOptions,
	SecretRef,
	SessionState,
	TotpCode,
	UnlockResult,
	VaultSnapshot,
} from "@shared/types/vault.types";

/**
 * Les événements IPC qui sont envoyés par les browserWindow vers le process main.
 *
 * Attention il faut que la callback prenne en paramètre un event de type Electron.IpcMainInvokeEvent
 */
export interface IpcHandledEvents {
	"app:close": (event: IpcMainInvokeEvent) => void;
	"app:screen:minimize": (event: IpcMainInvokeEvent) => void;
	"app:screen:toggle-fullscreen": (event: IpcMainInvokeEvent) => void;
	"app:screen:is-fullscreen": (event: IpcMainInvokeEvent) => boolean;
	/**
	 * Ouvre une adresse http(s) dans le navigateur par défaut
	 */
	"app:open-external": (event: IpcMainInvokeEvent, url: string) => Promise<void>;

	"config:get": (event: IpcMainInvokeEvent) => Promise<AppConfig>;
	"config:set": (event: IpcMainInvokeEvent, config: AppConfig) => Promise<void>;

	/**
	 * État de la session : compte connecté, coffre verrouillé ou non
	 */
	"session:state:get": (event: IpcMainInvokeEvent) => Promise<SessionState>;
	"session:login": (event: IpcMainInvokeEvent, request: LoginRequest) => Promise<LoginResult>;
	/** Stops a login waiting for the browser (SSO) */
	"session:login:cancel": (event: IpcMainInvokeEvent) => Promise<void>;
	"session:unlock": (event: IpcMainInvokeEvent, password: string) => Promise<UnlockResult>;
	"session:lock": (event: IpcMainInvokeEvent) => Promise<void>;
	"session:logout": (event: IpcMainInvokeEvent) => Promise<void>;

	/**
	 * Contenu du coffre, sans aucun secret
	 */
	"vault:snapshot:get": (event: IpcMainInvokeEvent) => Promise<VaultSnapshot>;
	"vault:sync": (event: IpcMainInvokeEvent) => Promise<VaultSnapshot>;
	/**
	 * Valeur d'un secret, pour l'afficher
	 */
	"vault:secret:get": (event: IpcMainInvokeEvent, itemId: string, ref: SecretRef) => Promise<string>;
	/**
	 * Copie une valeur d'un élément dans le presse-papiers, effacé ensuite selon la configuration
	 */
	"vault:copy": (event: IpcMainInvokeEvent, itemId: string | null, ref: CopyRef) => Promise<void>;
	"vault:totp:get": (event: IpcMainInvokeEvent, itemId: string) => Promise<TotpCode>;
	/**
	 * Vérifie le mot de passe maître pour les éléments protégés (reprompt), sans appel réseau
	 */
	"vault:reprompt:verify": (event: IpcMainInvokeEvent, password: string) => Promise<boolean>;
	/**
	 * Favicon d'un site, en data URL, via le service d'icônes du serveur
	 */
	"vault:icon:get": (event: IpcMainInvokeEvent, host: string) => Promise<string | null>;
	"vault:generate-password": (event: IpcMainInvokeEvent, options: PasswordGeneratorOptions) => Promise<string>;

	"autotype:availability": (event: IpcMainInvokeEvent) => Promise<AutoTypeAvailability>;
	/**
	 * Minimizes the window and types the sequence of a login item into the window that gets the focus
	 */
	"autotype:perform": (event: IpcMainInvokeEvent, itemId: string) => Promise<void>;

	/**
	 * Approuve l'autorité d'un certificat présenté à la connexion (par son empreinte SHA-256)
	 */
	"certificate:trust": (event: IpcMainInvokeEvent, fingerprint256: string) => Promise<void>;
	/**
	 * Importe un certificat d'autorité depuis un fichier choisi par l'utilisateur
	 */
	"certificate:import": (event: IpcMainInvokeEvent) => Promise<TrustedCertificate[]>;
	"certificate:list": (event: IpcMainInvokeEvent) => Promise<TrustedCertificate[]>;
	/**
	 * Retire une autorité approuvée ; le coffre est verrouillé pour relancer le CLI sans elle
	 */
	"certificate:remove": (event: IpcMainInvokeEvent, fingerprint256: string) => Promise<void>;

	"update:status:get": (event: IpcMainInvokeEvent) => UpdateStatus;
	/**
	 * Cherche une nouvelle version sur GitHub ; elle est téléchargée dès qu'elle est trouvée
	 */
	"update:check": (event: IpcMainInvokeEvent) => Promise<void>;
	/**
	 * Télécharge la version trouvée : utilisé pour revenir d'une bêta à la version stable
	 */
	"update:download": (event: IpcMainInvokeEvent) => Promise<void>;
	/**
	 * Verrouille le coffre puis redémarre sur la version téléchargée
	 */
	"update:quit-and-install": (event: IpcMainInvokeEvent) => Promise<void>;
}
