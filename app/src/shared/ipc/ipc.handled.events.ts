import type { IpcMainInvokeEvent } from "electron";
import type { AppConfig } from "@shared/config/app.config";
import type { TrustedCertificate } from "@shared/types/certificate.types";
import type { UpdateStatus } from "@shared/types/update.types";
import type {
	AutoTypeAvailability,
	CopyRef,
	HelloUnlockResult,
	HelloUnlockStatus,
	LoginRequest,
	LoginResult,
	PasswordGeneratorOptions,
	SecretRef,
	SessionState,
	SshImportResult,
	SshKeyPreview,
	SshKeySource,
	ItemDraft,
	TotpCode,
	TotpQrResult,
	UnlockResult,
	VaultSnapshot,
	WriteResult,
} from "@shared/types/vault.types";

/**
 * IPC events sent by the browser windows to the main process.
 *
 * Each callback takes an Electron.IpcMainInvokeEvent as first parameter
 */
export interface IpcHandledEvents {
	"app:close": (event: IpcMainInvokeEvent) => void;
	"app:screen:minimize": (event: IpcMainInvokeEvent) => void;
	"app:screen:toggle-fullscreen": (event: IpcMainInvokeEvent) => void;
	"app:screen:is-fullscreen": (event: IpcMainInvokeEvent) => boolean;
	/**
	 * Opens an http(s) address in the default browser
	 */
	"app:open-external": (event: IpcMainInvokeEvent, url: string) => Promise<void>;

	"config:get": (event: IpcMainInvokeEvent) => Promise<AppConfig>;
	"config:set": (event: IpcMainInvokeEvent, config: AppConfig) => Promise<void>;

	/**
	 * Session state: logged in account, vault locked or not
	 */
	"session:state:get": (event: IpcMainInvokeEvent) => Promise<SessionState>;
	"session:login": (event: IpcMainInvokeEvent, request: LoginRequest) => Promise<LoginResult>;
	/** Stops a login waiting for the browser (SSO) */
	"session:login:cancel": (event: IpcMainInvokeEvent) => Promise<void>;
	"session:unlock": (event: IpcMainInvokeEvent, password: string) => Promise<UnlockResult>;
	"session:lock": (event: IpcMainInvokeEvent) => Promise<void>;
	"session:logout": (event: IpcMainInvokeEvent) => Promise<void>;
	/**
	 * Unlock with Windows Hello: availability on this computer, and whether the current account can use it
	 */
	"session:hello:status": (event: IpcMainInvokeEvent) => Promise<HelloUnlockStatus>;
	/**
	 * Enables Windows Hello unlock for the unlocked account; the master password is confirmed then stored encrypted in the main process
	 */
	"session:hello:enable": (event: IpcMainInvokeEvent, password: string) => Promise<HelloUnlockResult>;
	"session:hello:disable": (event: IpcMainInvokeEvent) => Promise<void>;
	"session:hello:unlock": (event: IpcMainInvokeEvent) => Promise<HelloUnlockResult>;

	/**
	 * Vault content, without any secret
	 */
	"vault:snapshot:get": (event: IpcMainInvokeEvent) => Promise<VaultSnapshot>;
	"vault:sync": (event: IpcMainInvokeEvent) => Promise<VaultSnapshot>;
	/**
	 * Value of a secret, to show it
	 */
	"vault:secret:get": (event: IpcMainInvokeEvent, itemId: string, ref: SecretRef) => Promise<string>;
	/**
	 * Copies a value of an item to the clipboard, cleared afterwards according to the settings
	 */
	"vault:copy": (event: IpcMainInvokeEvent, itemId: string | null, ref: CopyRef) => Promise<void>;
	"vault:totp:get": (event: IpcMainInvokeEvent, itemId: string) => Promise<TotpCode>;
	/**
	 * Reads the TOTP secret of a QR code screenshot in the clipboard; the value goes back to the item draft only
	 */
	"vault:totp:read-qr": (event: IpcMainInvokeEvent) => Promise<TotpQrResult>;
	/**
	 * Checks the master password for the protected items (reprompt), without network call
	 */
	"vault:reprompt:verify": (event: IpcMainInvokeEvent, password: string) => Promise<boolean>;
	/**
	 * Website favicon, as a data URL, through the server's icon service
	 */
	"vault:icon:get": (event: IpcMainInvokeEvent, host: string) => Promise<string | null>;
	"vault:generate-password": (event: IpcMainInvokeEvent, options: PasswordGeneratorOptions) => Promise<string>;

	/**
	 * Creates an item in the personal vault
	 */
	"vault:item:create": (event: IpcMainInvokeEvent, draft: ItemDraft) => Promise<WriteResult>;
	/**
	 * Edits an item; `expectedRevision` is the revision the editor started from (conflict when it changed)
	 */
	"vault:item:update": (event: IpcMainInvokeEvent, itemId: string, expectedRevision: string, draft: ItemDraft) => Promise<WriteResult>;
	/** Moves an item to the trash */
	"vault:item:delete": (event: IpcMainInvokeEvent, itemId: string) => Promise<WriteResult>;
	/** Restores an item from the trash */
	"vault:item:restore": (event: IpcMainInvokeEvent, itemId: string) => Promise<WriteResult>;
	/** Permanently deletes items of the trash (only items in the trash are accepted) */
	"vault:item:purge": (event: IpcMainInvokeEvent, itemIds: string[]) => Promise<WriteResult>;
	"vault:item:favorite": (event: IpcMainInvokeEvent, itemId: string, favorite: boolean) => Promise<WriteResult>;
	"vault:item:move": (event: IpcMainInvokeEvent, itemId: string, folderId: string | null) => Promise<WriteResult>;
	"vault:folder:create": (event: IpcMainInvokeEvent, name: string) => Promise<WriteResult>;
	/**
	 * Renames a folder path ("Work/Projects") and every folder under it, virtual parents included
	 */
	"vault:folder:rename": (event: IpcMainInvokeEvent, path: string, newPath: string) => Promise<WriteResult>;
	/** Deletes an empty folder (no active item, no sub folder) */
	"vault:folder:delete": (event: IpcMainInvokeEvent, folderId: string) => Promise<WriteResult>;
	/**
	 * Generates an Ed25519 key; the private key stays in the main process, behind the returned token
	 */
	"vault:ssh:generate": (event: IpcMainInvokeEvent) => Promise<SshKeyPreview>;
	/**
	 * Converts a key to OpenSSH (unencrypted) in the main process: from a file chosen by the user, pasted text, or a key
	 * waiting for its passphrase. The passphrase is only used for an encrypted key.
	 */
	"vault:ssh:import": (event: IpcMainInvokeEvent, source: SshKeySource, passphrase: string | null) => Promise<SshImportResult>;

	"autotype:availability": (event: IpcMainInvokeEvent) => Promise<AutoTypeAvailability>;
	/**
	 * Minimizes the window and types the sequence of a login item into the window that gets the focus
	 */
	"autotype:perform": (event: IpcMainInvokeEvent, itemId: string) => Promise<void>;

	/**
	 * Approves the authority of a certificate presented at login (by its SHA-256 fingerprint)
	 */
	"certificate:trust": (event: IpcMainInvokeEvent, fingerprint256: string) => Promise<void>;
	/**
	 * Imports an authority certificate from a file chosen by the user
	 */
	"certificate:import": (event: IpcMainInvokeEvent) => Promise<TrustedCertificate[]>;
	"certificate:list": (event: IpcMainInvokeEvent) => Promise<TrustedCertificate[]>;
	/**
	 * Removes an approved authority; the vault is locked to restart the CLI without it
	 */
	"certificate:remove": (event: IpcMainInvokeEvent, fingerprint256: string) => Promise<void>;

	"update:status:get": (event: IpcMainInvokeEvent) => UpdateStatus;
	/**
	 * Checks GitHub for a new version; it is downloaded as soon as it is found
	 */
	"update:check": (event: IpcMainInvokeEvent) => Promise<void>;
	/**
	 * Downloads the version found: used to go back from a beta to the stable version
	 */
	"update:download": (event: IpcMainInvokeEvent) => Promise<void>;
	/**
	 * Locks the vault then restarts on the downloaded version
	 */
	"update:quit-and-install": (event: IpcMainInvokeEvent) => Promise<void>;
}
