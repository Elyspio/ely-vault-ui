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
};

export type VaultField = {
	name: string;
	type: FieldType;
	/** Clear value, only for non-hidden fields */
	value: string | null;
	hasValue: boolean;
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
	fields: VaultField[];
	passwordHistoryCount: number;
	login?: {
		username: string | null;
		uris: LoginUri[];
		hasPassword: boolean;
		hasTotp: boolean;
		passwordRevisionDate: string | null;
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
	folders: VaultFolder[];
	organizations: VaultOrganization[];
	collections: VaultCollection[];
	lastSync: string | null;
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
	| { status: "untrusted-certificate"; certificate: CertificateInfo }
	| { status: "error"; message: string };

/** Whether auto-type can run on this system, with the reason when it cannot */
export type AutoTypeAvailability = { available: true } | { available: false; reason: string };

export type UnlockResult = { status: "success" } | { status: "error"; message: string };
