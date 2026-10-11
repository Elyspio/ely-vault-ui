import crypto from "node:crypto";
import sshpk from "sshpk";

/**
 * SSH key of an SSH key item: the private key is unencrypted OpenSSH, as the official clients store it
 */
export type SshKeyMaterial = {
	privateKey: string;
	/** OpenSSH public key ("type base64"), without comment */
	publicKey: string;
	/** SHA-256 fingerprint, as ssh-keygen shows it ("SHA256:...") */
	keyFingerprint: string;
	/** SSH algorithm name, e.g. ssh-ed25519 */
	keyType: string;
};

export type SshKeyError = {
	error: "passphrase-required" | "wrong-passphrase" | "unsupported" | "invalid";
	message: string;
};

const PASSPHRASE_REQUIRED = "This key is protected by a passphrase";
const WRONG_PASSPHRASE = "Wrong passphrase";
const DSA_UNSUPPORTED = "DSA keys are not supported: use an Ed25519, RSA or ECDSA key";
const PUBLIC_KEY = "This is a public key: choose or paste the private key";
const INVALID_FORMAT = "Not a private key: OpenSSH, PEM or PKCS#8 format expected";

/** PEM blocks encrypted with a passphrase (PKCS#8, or legacy PEM with a DEK-Info header) */
const ENCRYPTED_PEM = /-----BEGIN ENCRYPTED PRIVATE KEY-----|Proc-Type:\s*4,ENCRYPTED/;

/** Key algorithms the app accepts */
const SUPPORTED_TYPES = new Set(["ed25519", "rsa", "ecdsa"]);

/**
 * Failure of the conversion, with the reason the renderer shows
 */
class ConvertFailure extends Error {
	public readonly error: SshKeyError["error"];

	public constructor(error: SshKeyError["error"], message: string) {
		super(message);
		this.error = error;
	}
}

/**
 * New Ed25519 key pair
 */
export function generateSshKey(): SshKeyMaterial {
	return toMaterial(sshpk.generatePrivateKey("ed25519"));
}

/**
 * Converts a private key (OpenSSH, PEM or PKCS#8, encrypted or not) to unencrypted OpenSSH.
 * `passphrase` is only used for an encrypted key; null when the user has not given one yet.
 *
 * The text is never part of an error message: the caller may show or log them.
 */
export function convertSshKey(text: string, passphrase: string | null): SshKeyMaterial | SshKeyError {
	const source = text.trim();
	if (source === "") return { error: "invalid", message: INVALID_FORMAT };

	let key: sshpk.PrivateKey;
	try {
		key = parsePrivate(source, passphrase || null);
	} catch (error) {
		return toFailure(error, source, passphrase || null);
	}

	if (key.type === "dsa") return { error: "unsupported", message: DSA_UNSUPPORTED };
	if (!SUPPORTED_TYPES.has(key.type)) return { error: "unsupported", message: `Unsupported key type: ${key.type}` };

	return toMaterial(key);
}

function parsePrivate(source: string, passphrase: string | null): sshpk.PrivateKey {
	// Encrypted PEM is decrypted by Node: a wrong passphrase fails synchronously, sshpk reports it asynchronously
	if (ENCRYPTED_PEM.test(source)) return sshpk.parsePrivateKey(decryptPem(source, passphrase), "auto");
	return sshpk.parsePrivateKey(source, "auto", { passphrase: passphrase ?? undefined });
}

function decryptPem(source: string, passphrase: string | null): string {
	if (passphrase === null) throw new ConvertFailure("passphrase-required", PASSPHRASE_REQUIRED);
	try {
		return crypto.createPrivateKey({ key: source, format: "pem", passphrase }).export({ type: "pkcs8", format: "pem" }).toString();
	} catch {
		throw new ConvertFailure("wrong-passphrase", WRONG_PASSPHRASE);
	}
}

function toFailure(error: unknown, source: string, passphrase: string | null): SshKeyError {
	if (error instanceof ConvertFailure) return { error: error.error, message: error.message };

	const name = error instanceof Error ? error.name : "";
	const message = error instanceof Error ? error.message : "";
	if (name === "KeyEncryptedError") {
		return passphrase === null ? { error: "passphrase-required", message: PASSPHRASE_REQUIRED } : { error: "wrong-passphrase", message: WRONG_PASSPHRASE };
	}
	if (/Incorrect passphrase/i.test(message)) return { error: "wrong-passphrase", message: WRONG_PASSPHRASE };
	if (isPublicKey(source)) return { error: "invalid", message: PUBLIC_KEY };
	return { error: "invalid", message: INVALID_FORMAT };
}

function isPublicKey(source: string): boolean {
	try {
		sshpk.parseKey(source, "auto");
		return true;
	} catch {
		return false;
	}
}

function toMaterial(key: sshpk.PrivateKey): SshKeyMaterial {
	const publicKey = key.toPublic();
	// The public line may carry a comment: only "type base64" is kept
	const [keyType, base64] = publicKey.toString("ssh").trim().split(/\s+/);

	return {
		privateKey: key.toString("openssh"),
		publicKey: `${keyType} ${base64}`,
		keyFingerprint: publicKey.fingerprint("sha256").toString(),
		keyType,
	};
}
