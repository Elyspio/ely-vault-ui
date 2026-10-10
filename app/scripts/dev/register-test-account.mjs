// Registers a test account on a local development Vaultwarden (see docs/development/local-test-server.md).
// Usage: node scripts/dev/register-test-account.mjs <serverUrl> <email> <password>
// The client-side key derivation mirrors the Bitwarden clients: PBKDF2-SHA256 (600 000 iterations),
// HKDF stretched master key, a random 512-bit user key and an RSA-2048 key pair.
import crypto from "node:crypto";

// Defaults from scripts/dev/dev-vault.env (loaded by the pnpm script with --env-file)
const [serverUrl = process.env.DEV_VAULT_SERVER, email = process.env.DEV_VAULT_EMAIL, password = process.env.DEV_VAULT_PASSWORD] = process.argv.slice(2);

if (!serverUrl || !email || !password) {
	console.error("Usage: node scripts/dev/register-test-account.mjs <serverUrl> <email> <password>");
	process.exit(1);
}

const iterations = 600_000;
const normalizedEmail = email.trim().toLowerCase();

const masterKey = crypto.pbkdf2Sync(password, normalizedEmail, iterations, 32, "sha256");
const masterPasswordHash = crypto.pbkdf2Sync(masterKey, password, 1, 32, "sha256").toString("base64");

/** HKDF-Expand only (the master key is already a uniform PRK), as in the Bitwarden clients */
function hkdfExpand(prk, info, length) {
	const infoBuffer = Buffer.from(info, "utf8");
	const output = [];
	let previous = Buffer.alloc(0);
	for (let i = 0; output.reduce((sum, block) => sum + block.length, 0) < length; i++) {
		previous = crypto
			.createHmac("sha256", prk)
			.update(Buffer.concat([previous, infoBuffer, Buffer.from([i + 1])]))
			.digest();
		output.push(previous);
	}
	return Buffer.concat(output).subarray(0, length);
}

/** EncString type 2: AES-256-CBC + HMAC-SHA256 */
function encrypt(data, encKey, macKey) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv("aes-256-cbc", encKey, iv);
	const ct = Buffer.concat([cipher.update(data), cipher.final()]);
	const mac = crypto.createHmac("sha256", macKey).update(Buffer.concat([iv, ct])).digest();
	return `2.${iv.toString("base64")}|${ct.toString("base64")}|${mac.toString("base64")}`;
}

const stretchedEnc = hkdfExpand(masterKey, "enc", 32);
const stretchedMac = hkdfExpand(masterKey, "mac", 32);

const userKey = crypto.randomBytes(64);
const protectedUserKey = encrypt(userKey, stretchedEnc, stretchedMac);

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicKeyEncoding: { type: "spki", format: "der" },
	privateKeyEncoding: { type: "pkcs8", format: "der" },
});
const encryptedPrivateKey = encrypt(privateKey, userKey.subarray(0, 32), userKey.subarray(32, 64));

async function post(path, body) {
	return await fetch(new URL(path, serverUrl), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

// Without SMTP, Vaultwarden answers the verification step with the registration token itself.
const verification = await post("/identity/accounts/register/send-verification-email", {
	email: normalizedEmail,
	name: normalizedEmail.split("@")[0],
	receiveMarketingEmails: false,
});
const emailVerificationToken = (await verification.text()).replaceAll('"', "");

if (!verification.ok || !emailVerificationToken) {
	console.error(`Verification step failed (${verification.status}). Is SMTP configured on this server?`);
	process.exit(1);
}

const response = await post("/identity/accounts/register/finish", {
	email: normalizedEmail,
	emailVerificationToken,
	masterPasswordHash,
	masterPasswordHint: null,
	userSymmetricKey: protectedUserKey,
	userAsymmetricKeys: {
		publicKey: publicKey.toString("base64"),
		encryptedPrivateKey,
	},
	kdf: 0,
	kdfIterations: iterations,
});

if (!response.ok) {
	console.error(`Registration failed (${response.status}):`, await response.text());
	process.exit(1);
}

console.log(`Registered ${normalizedEmail} on ${serverUrl}`);
