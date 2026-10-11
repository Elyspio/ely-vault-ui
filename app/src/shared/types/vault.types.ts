import type { CertificateInfo } from "./certificate.types";

/**
 * Types shared by the main process and the renderer.
 *
 * The renderer never receives a secret in bulk: items are sanitized by the main process
 * (passwords, TOTP seeds, card numbers, hidden fields and private keys are replaced by flags)
 * and each secret is fetched or copied on demand, by item id and {@link SecretRef}.
 */

export enum CipherType {
	Login = 1,
	SecureNote = 2,
	Card = 3,
	Identity = 4,
	SshKey = 5,
}

export enum FieldType {
	Text = 0,
	Hidden = 1,
	Boolean = 2,
	Linked = 3,
}

/** How a login uri is matched against a website, null for the account default (domain) */
export enum UriMatchType {
	Domain = 0,
	Host = 1,
	StartsWith = 2,
	Exact = 3,
	RegularExpression = 4,
	Never = 5,
}

export type VaultStatus = "unauthenticated" | "locked" | "unlocked";

export type AccountInfo = {
	serverUrl: string | null;
	email: string | null;
	lastSync: string | null;
};

export type SessionState = AccountInfo & {
	status: VaultStatus;
};

export type LoginUri = {
	uri: string;
	/** Hostname used for the favicon, null when the uri is not a web address */
	host: string | null;
	match: UriMatchType | null;
};

export type VaultField = {
	name: string;
	type: FieldType;
	/** Clear value, only for non-hidden fields */
	value: string | null;
	hasValue: boolean;
	/** Linked fields only: property of the item the field points to */
	linkedId: number | null;
};

export type VaultItem = {
	id: string;
	type: CipherType;
	name: string;
	notes: string | null;
	favorite: boolean;
	/** The master password is asked again before revealing or copying a secret of this item */
	reprompt: boolean;
	folderId: string | null;
	organizationId: string | null;
	collectionIds: string[];
	revisionDate: string;
	creationDate: string | null;
	/** Set when the item is in the trash */
	deletedDate: string | null;
	fields: VaultField[];
	passwordHistoryCount: number;
	login?: {
		username: string | null;
		uris: LoginUri[];
		hasPassword: boolean;
		hasTotp: boolean;
		passwordRevisionDate: string | null;
		/** Passkeys are kept as they are by edits, never sent to the renderer */
		passkeyCount: number;
	};
	card?: {
		cardholderName: string | null;
		brand: string | null;
		expMonth: string | null;
		expYear: string | null;
		numberLast4: string | null;
		hasNumber: boolean;
		hasCode: boolean;
	};
	identity?: Record<IdentityKey, string | null>;
	sshKey?: {
		publicKey: string | null;
		keyFingerprint: string | null;
		hasPrivateKey: boolean;
	};
};

export const identityKeys = [
	"title",
	"firstName",
	"middleName",
	"lastName",
	"username",
	"company",
	"email",
	"phone",
	"address1",
	"address2",
	"address3",
	"city",
	"state",
	"postalCode",
	"country",
	"ssn",
	"passportNumber",
	"licenseNumber",
] as const;

export type IdentityKey = (typeof identityKeys)[number];

export type VaultFolder = {
	id: string;
	name: string;
};

export type VaultOrganization = {
	id: string;
	name: string;
};

export type VaultCollection = {
	id: string;
	organizationId: string;
	name: string;
};

export type VaultSnapshot = {
	items: VaultItem[];
	/** Deleted items (archived ones included), until the server purges them */
	trash: VaultItem[];
	folders: VaultFolder[];
	organizations: VaultOrganization[];
	collections: VaultCollection[];
	lastSync: string | null;
};

/**
 * Generator modes: Bitwarden password (character classes) or random bytes encoded in hex / base64
 */
export type PasswordGeneratorMode = "password" | "hex" | "base64";

export type PasswordGeneratorOptions = {
	mode: PasswordGeneratorMode;
	/** Number of characters of the result */
	length: number;
	/** Special characters (password mode only) */
	special: boolean;
};

/** A secret value of an item, fetched on demand */
export type SecretRef = { kind: "password" } | { kind: "cardNumber" } | { kind: "cardCode" } | { kind: "sshPrivateKey" } | { kind: "field"; index: number };

/** Any value of an item that can be copied (secret or not), copied by the main process */
export type CopyRef = SecretRef | { kind: "username" } | { kind: "uri"; index: number } | { kind: "totp" } | { kind: "notes" } | { kind: "text"; value: string };

export type TotpCode = {
	code: string;
	period: number;
	/** Seconds before the code changes */
	remaining: number;
};

export type LoginRequest = {
	serverUrl: string;
	email: string;
	password: string;
	twoFactor?: {
		method: TwoFactorMethod;
		code: string;
	};
	/** Single sign-on in the browser instead of the e-mail and password; the password still decrypts the vault */
	sso?: boolean;
};

/** Bitwarden two-step login providers usable from the CLI */
export enum TwoFactorMethod {
	Authenticator = 0,
	Email = 1,
	Yubikey = 3,
}

export type LoginResult =
	| { status: "success" }
	| { status: "two-factor-required" }
	/** The server only accepts single sign-on for this account */
	| { status: "sso-required" }
	| { status: "untrusted-certificate"; certificate: CertificateInfo }
	| { status: "error"; message: string };

/** Whether auto-type can run on this system, with the reason when it cannot */
export type AutoTypeAvailability = { available: true } | { available: false; reason: string };

export type UnlockResult = { status: "success" } | { status: "error"; message: string };

// region Write operations

/**
 * Change of a secret value in an edit: absent means unchanged (the renderer does not know the current value)
 */
export type SecretChange = { kind: "set"; value: string } | { kind: "clear" };

/**
 * Custom field of an {@link ItemDraft}, in the order wanted by the user
 */
export type DraftField = {
	/** Index of the field in the item before the edit, null for a new field */
	originalIndex: number | null;
	name: string;
	type: FieldType;
	/**
	 * Text and boolean fields: the value as is.
	 * Hidden fields: absent keeps the value of `originalIndex`, otherwise set / clear.
	 * Linked fields: ignored, the original link is kept (they cannot be created).
	 */
	value?: string | null;
	secret?: SecretChange;
};

export type DraftUri = { uri: string; match: UriMatchType | null };

/**
 * Wanted state of an item, sent by the renderer to create or edit it.
 *
 * Non-secret values are complete; secrets only travel when the user typed them ({@link SecretChange}).
 * The main process merges it onto the decrypted item, so everything the draft does not know (passkeys,
 * linked fields, password history, attachments…) is kept.
 */
export type ItemDraft = {
	type: CipherType;
	name: string;
	notes: string | null;
	favorite: boolean;
	reprompt: boolean;
	folderId: string | null;
	fields: DraftField[];
	login?: {
		username: string | null;
		uris: DraftUri[];
		password?: SecretChange;
		/** Base32 secret, otpauth://totp uri or steam:// secret */
		totp?: SecretChange;
	};
	card?: {
		cardholderName: string | null;
		brand: string | null;
		expMonth: string | null;
		expYear: string | null;
		number?: SecretChange;
		code?: SecretChange;
	};
	identity?: Record<IdentityKey, string | null>;
	/** Only to create a key or replace it: token of a key generated or imported by the main process ({@link SshKeyPreview}); an unchanged key is not sent */
	sshKey?: { token: string };
};

/**
 * Result of a write on the server, independent of the refresh of the snapshot that follows
 */
export type WriteOutcome =
	| {
			status: "success";
			/** Created or edited item / folder */
			id: string | null;
			/** Objects written by an operation on several objects */
			done?: string[];
	  }
	/** The item changed elsewhere since the editor opened it: nothing written, the vault was synced */
	| { status: "conflict" }
	| { status: "error"; message: string }
	/** Operations on several objects (empty trash, folder rename cascade): stopped at the first failure */
	| { status: "partial"; done: string[]; failed: { id: string; message: string } };

export type WriteResult = {
	outcome: WriteOutcome;
	/** Vault after the write, null when reloading it failed (the write may still have succeeded) */
	snapshot: VaultSnapshot | null;
	refreshError: string | null;
};

// endregion

// region SSH keys

/**
 * Key generated or imported by the main process: the private key never leaves it. The token stands for it in a
 * draft until the item is saved, and expires after a few minutes.
 */
export type SshKeyPreview = {
	token: string;
	/** SSH algorithm name, e.g. ssh-ed25519 */
	keyType: string;
	/** Public key in OpenSSH format, without comment */
	publicKey: string;
	/** SHA-256 fingerprint, as ssh-keygen shows it */
	keyFingerprint: string;
};

/** Origin of an SSH key to import: a file chosen in a dialog, text pasted by the user, or a key waiting for its passphrase */
export type SshKeySource = { kind: "file" } | { kind: "text"; text: string } | { kind: "pending"; token: string };

export type SshImportResult =
	| { status: "success"; key: SshKeyPreview }
	/** Encrypted key: the passphrase is asked, then the key is imported again with `{ kind: "pending", token }` */
	| { status: "passphrase-required"; token: string }
	| { status: "cancelled" }
	| { status: "error"; message: string };

// endregion
