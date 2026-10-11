/** Envelope of every `bw --response` output and `bw serve` answer */
export type BwResponse<T = unknown> = { success: true; data: T } | { success: false; message: string };

export type BwList<T> = { object: "list"; data: T[] };
export type BwString = { object: "string"; data: string };
export type BwMessage = { object: "message"; title: string; message: string | null; raw?: string };

export type BwStatus = {
	object: "template";
	template: {
		serverUrl: string | null;
		lastSync: string | null;
		userEmail?: string;
		userId?: string;
		status: "unauthenticated" | "locked" | "unlocked";
	};
};

export type BwField = { name: string | null; value: string | null; type: number; linkedId?: number | null };

/**
 * A decrypted cipher, as `bw serve` returns it.
 *
 * Edits send back the whole object returned by `GET /object/item/:id` (the CLI replaces nested objects instead of
 * merging them): the index signature keeps the properties the app does not know.
 */
export type BwItem = {
	[key: string]: unknown;
	id: string;
	organizationId?: string | null;
	folderId: string | null;
	type: number;
	reprompt: number;
	name: string;
	notes?: string | null;
	favorite: boolean;
	fields?: BwField[];
	collectionIds?: string[];
	revisionDate: string;
	creationDate?: string | null;
	deletedDate?: string | null;
	archivedDate?: string | null;
	passwordHistory?: unknown[] | null;
	login?: {
		uris?: { uri: string | null; match?: number | null }[] | null;
		username: string | null;
		password: string | null;
		totp: string | null;
		passwordRevisionDate: string | null;
		/** Passkeys: never read by the app, kept as they are by edits */
		fido2Credentials?: unknown[] | null;
	};
	card?: {
		cardholderName: string | null;
		brand: string | null;
		number: string | null;
		expMonth: string | null;
		expYear: string | null;
		code: string | null;
	};
	identity?: Record<string, string | null>;
	sshKey?: {
		privateKey: string | null;
		publicKey: string | null;
		keyFingerprint: string | null;
	};
};

export type BwFolder = { id: string | null; name: string };
export type BwOrganization = { id: string; name: string };
export type BwCollection = { id: string; organizationId: string; name: string };

export class BwError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "BwError";
	}
}
