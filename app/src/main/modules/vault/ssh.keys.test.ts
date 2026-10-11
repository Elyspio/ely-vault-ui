import crypto from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { convertSshKey, generateSshKey, type SshKeyError, type SshKeyMaterial } from "./ssh.keys";
import { appMessage } from "@shared/i18n/message";

/*
 * Test-only keys, generated once with ssh-keygen. They protect nothing.
 */

/** Ed25519, no passphrase (comment "test-only") */
const PLAIN_OPENSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACA+bJHvXFsB1YUIGwkXfKK38xSI0vCN0FbO0M3Dmh9RwQAAAJCbx3LBm8dy
wQAAAAtzc2gtZWQyNTUxOQAAACA+bJHvXFsB1YUIGwkXfKK38xSI0vCN0FbO0M3Dmh9RwQ
AAAEDXEWOo5g7ESJPyHtsiaUI+pooboo/cFbPT5KSY8xxlyj5ske9cWwHVhQgbCRd8orfz
FIjS8I3QVs7QzcOaH1HBAAAACXRlc3Qtb25seQECAwQ=
-----END OPENSSH PRIVATE KEY-----
`;
const PLAIN_PUBLIC = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID5ske9cWwHVhQgbCRd8orfzFIjS8I3QVs7QzcOaH1HB";
const PLAIN_FINGERPRINT = "SHA256:0gHFwn3G3CDJMDvue5Yf0hxGytOrTBk7AtAPBCU7YtA";

/** Ed25519, passphrase "correct horse" */
const ENCRYPTED_OPENSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABCdZEjg3f
bjGBlbprUpnbWBAAAAGAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIL3HOFu+RMLxTcPu
s60JmzpDJ7OPdKuWNXI8G0Rw6LDiAAAAkC+V4K3ZfrGGDfjHUxwmW6/Oo/8EscS3BMHlRl
zvLiZXNnUSoiCSmRNxcybAUOXcjxmNiPIfjcEPyJnvJpy8Mto0JBtjZvi0SqtKAe8FyGOv
qZVfWAa/PWuDevwfhv0E1r0S1nMEntShY4+RTicOee1gcrMZjc1Feerii28ImHAZ1e8/zQ
q/pEU0G0LqIhFz4Q==
-----END OPENSSH PRIVATE KEY-----
`;
const ENCRYPTED_PASSPHRASE = "correct horse";
const ENCRYPTED_PUBLIC = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL3HOFu+RMLxTcPus60JmzpDJ7OPdKuWNXI8G0Rw6LDi";
const ENCRYPTED_FINGERPRINT = "SHA256:v89vPZA6CQCSbOupxiedrsJneMZ7KlRCi/VEth7CzXo";

/** SSH wire string: uint32 big-endian length, then the bytes */
function sshString(bytes: Buffer | string): Buffer {
	const data = Buffer.from(bytes);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	return Buffer.concat([length, data]);
}

/** SHA256 fingerprint computed by hand from the raw Ed25519 public key (independent of sshpk) */
function ed25519Fingerprint(publicPem: string): string {
	const spki = crypto.createPublicKey(publicPem).export({ format: "der", type: "spki" });
	const raw = spki.subarray(spki.length - 32);
	const wire = Buffer.concat([sshString("ssh-ed25519"), sshString(raw)]);
	return `SHA256:${crypto.createHash("sha256").update(wire).digest("base64").replace(/=+$/, "")}`;
}

function isError(result: SshKeyMaterial | SshKeyError): result is SshKeyError {
	return "error" in result;
}

function expectMaterial(result: SshKeyMaterial | SshKeyError): SshKeyMaterial {
	if (isError(result)) throw new Error(`Expected a key, got ${result.error}: ${result.message}`);
	return result;
}

function expectError(result: SshKeyMaterial | SshKeyError): SshKeyError {
	if (!isError(result)) throw new Error("Expected an error, got a key");
	return result;
}

/** Ed25519 key as an encrypted PKCS#8 PEM block, generated for the test */
function encryptedPkcs8(passphrase: string) {
	const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
	return {
		pem: privateKey.export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase }).toString(),
		publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
	};
}

describe("generateSshKey", () => {
	it("creates an Ed25519 key in OpenSSH format, without comment", () => {
		const key = generateSshKey();

		expect(key.keyType).toBe("ssh-ed25519");
		expect(key.privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
		expect(key.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+$/);
		expect(key.keyFingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
	});

	it("gives a different key each time", () => {
		expect(generateSshKey().publicKey).not.toBe(generateSshKey().publicKey);
	});

	it("converts back to the same public key and fingerprint", () => {
		const generated = generateSshKey();
		const converted = expectMaterial(convertSshKey(generated.privateKey, null));

		// The private key differs (random check bytes and comment), the identity does not
		expect(converted.publicKey).toBe(generated.publicKey);
		expect(converted.keyFingerprint).toBe(generated.keyFingerprint);
		expect(converted.keyType).toBe("ssh-ed25519");
	});
});

describe("convertSshKey", () => {
	it("keeps the public key and fingerprint of an OpenSSH key, without its comment", () => {
		const key = expectMaterial(convertSshKey(PLAIN_OPENSSH, null));

		expect(key.publicKey).toBe(PLAIN_PUBLIC);
		expect(key.keyFingerprint).toBe(PLAIN_FINGERPRINT);
		expect(key.keyType).toBe("ssh-ed25519");
		expect(key.privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
	});

	it("converts an unencrypted PKCS#8 key to OpenSSH with the fingerprint of its public key", () => {
		const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
		const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
		const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

		const key = expectMaterial(convertSshKey(pem, null));

		expect(key.privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
		expect(key.keyFingerprint).toBe(ed25519Fingerprint(publicPem));
		expect(key.publicKey.split(" ")).toHaveLength(2);
	});

	it("converts an RSA key", () => {
		const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
		const key = expectMaterial(convertSshKey(privateKey.export({ type: "pkcs8", format: "pem" }).toString(), null));

		expect(key.keyType).toBe("ssh-rsa");
		expect(key.publicKey.startsWith("ssh-rsa ")).toBe(true);
		expect(key.keyFingerprint).toMatch(/^SHA256:/);
	});

	it("converts an ECDSA key", () => {
		const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
		const key = expectMaterial(convertSshKey(privateKey.export({ type: "pkcs8", format: "pem" }).toString(), null));

		expect(key.keyType).toBe("ecdsa-sha2-nistp256");
		expect(key.keyFingerprint).toMatch(/^SHA256:/);
	});

	it("asks the passphrase of an encrypted OpenSSH key", () => {
		const error = expectError(convertSshKey(ENCRYPTED_OPENSSH, null));
		expect(error.error).toBe("passphrase-required");
	});

	it("converts an encrypted OpenSSH key with the right passphrase", () => {
		const key = expectMaterial(convertSshKey(ENCRYPTED_OPENSSH, ENCRYPTED_PASSPHRASE));

		expect(key.publicKey).toBe(ENCRYPTED_PUBLIC);
		expect(key.keyFingerprint).toBe(ENCRYPTED_FINGERPRINT);
		// The stored key is unencrypted: it converts again without passphrase
		expect(expectMaterial(convertSshKey(key.privateKey, null)).keyFingerprint).toBe(ENCRYPTED_FINGERPRINT);
	});

	it("refuses a wrong passphrase for an encrypted OpenSSH key", () => {
		const error = expectError(convertSshKey(ENCRYPTED_OPENSSH, "wrong"));
		expect(error).toEqual({ error: "wrong-passphrase", message: appMessage("sshWrongPassphrase") });
	});

	it("asks the passphrase of an encrypted PKCS#8 key, then converts it with the right one", () => {
		const { pem, publicPem } = encryptedPkcs8("pw");

		expect(expectError(convertSshKey(pem, null)).error).toBe("passphrase-required");
		expect(expectError(convertSshKey(pem, "nope")).error).toBe("wrong-passphrase");

		const key = expectMaterial(convertSshKey(pem, "pw"));
		expect(key.keyFingerprint).toBe(ed25519Fingerprint(publicPem));
	});

	it("survives many wrong passphrases on both encrypted formats", () => {
		// OpenSSH keys are slow to derive (bcrypt): a few attempts are enough to catch an asynchronous failure
		const { pem } = encryptedPkcs8("pw");
		for (let attempt = 0; attempt < 10; attempt++) {
			expect(expectError(convertSshKey(pem, `wrong-${attempt}`)).error).toBe("wrong-passphrase");
			expect(expectError(convertSshKey(ENCRYPTED_OPENSSH, `wrong-${attempt}`)).error).toBe("wrong-passphrase");
		}
	});

	it("treats an empty passphrase as none", () => {
		expect(expectError(convertSshKey(ENCRYPTED_OPENSSH, "")).error).toBe("passphrase-required");
	});

	it("refuses DSA keys", () => {
		const { privateKey } = crypto.generateKeyPairSync("dsa", { modulusLength: 1024, divisorLength: 160 });
		const error = expectError(convertSshKey(privateKey.export({ type: "pkcs8", format: "pem" }).toString(), null));

		expect(error.error).toBe("unsupported");
		expect(error.message).toBe(appMessage("sshDsaUnsupported"));
	});

	it("refuses a public key, with a message asking for the private key", () => {
		const error = expectError(convertSshKey(PLAIN_PUBLIC, null));

		expect(error.error).toBe("invalid");
		expect(error.message).toBe(appMessage("sshPublicKey"));
	});

	it("refuses text that is not a key, and an empty text", () => {
		expect(expectError(convertSshKey("hello world", null)).error).toBe("invalid");
		expect(expectError(convertSshKey("   ", null)).error).toBe("invalid");
	});

	it("does not put the key material in the error messages", () => {
		for (const text of [PLAIN_PUBLIC, "not a key\nsecret-looking-line", ENCRYPTED_OPENSSH]) {
			const error = expectError(convertSshKey(text, "wrong"));
			expect(error.message).not.toContain("secret-looking-line");
			expect(error.message).not.toContain("BEGIN");
		}
	});
});
