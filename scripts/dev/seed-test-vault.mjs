// Seeds the local development vault with sample items through `bw serve` (see readme, "Local test server").
// Usage: node scripts/dev/seed-test-vault.mjs <serverUrl> <email> <password>
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Defaults from scripts/dev/dev-vault.env (loaded by the pnpm script with --env-file)
const [serverUrl = process.env.DEV_VAULT_SERVER, email = process.env.DEV_VAULT_EMAIL, password = process.env.DEV_VAULT_PASSWORD] = process.argv.slice(2);

if (!serverUrl || !email || !password) {
	console.error("Usage: node scripts/dev/seed-test-vault.mjs <serverUrl> <email> <password>");
	process.exit(1);
}

const bwPath = createRequire(import.meta.url).resolve("@bitwarden/cli/build/bw.js");
const appDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-seed-"));
const env = { ...process.env, BITWARDENCLI_APPDATA_DIR: appDataDir, BW_PASSWORD: password };
const port = 18_087;

function bw(...args) {
	const result = spawnSync(process.execPath, [bwPath, ...args, "--response", "--nointeraction"], { env, encoding: "utf8" });
	const line = result.stdout.split("\n").find((l) => l.startsWith("{"));
	const response = line ? JSON.parse(line) : { success: false, message: result.stderr };
	if (!response.success) throw new Error(`bw ${args[0]}: ${response.message}`);
	return response.data;
}

async function api(method, route, body) {
	const response = await fetch(`http://127.0.0.1:${port}${route}`, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await response.json();
	if (!json.success) throw new Error(`${method} ${route}: ${json.message}`);
	return json.data;
}

const login = (overrides) => ({ type: 1, favorite: false, reprompt: 0, notes: null, fields: [], ...overrides });

bw("config", "server", serverUrl);
const session = bw("login", email, "--passwordenv", "BW_PASSWORD").raw;

const server = spawn(process.execPath, [bwPath, "serve", "--hostname", "127.0.0.1", "--port", String(port)], {
	env: { ...env, BW_SESSION: session },
	stdio: "ignore",
});

try {
	for (let i = 0; i < 50; i++) {
		try {
			await api("GET", "/status");
			break;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}

	const folders = {};
	for (const name of ["Perso", "Travail", "Finances", "Serveurs"]) {
		folders[name] = (await api("POST", "/object/folder", { name })).id;
	}

	const items = [
		login({
			name: "GitHub",
			folderId: folders.Travail,
			favorite: true,
			login: {
				username: "dev-octocat",
				password: "gh-S3cure!Passw0rd",
				totp: "JBSWY3DPEHPK3PXP",
				uris: [{ match: null, uri: "https://github.com/login" }],
			},
			notes: "Compte principal, clés SSH associées dans « Serveurs ».",
			fields: [
				{ name: "Recovery code", value: "a1b2-c3d4-e5f6", type: 1 },
				{ name: "Organisation", value: "elyspio", type: 0 },
			],
		}),
		login({
			name: "Google",
			folderId: folders.Perso,
			favorite: true,
			login: { username: "jean.dupont@gmail.com", password: "G00gle-Pa55!", uris: [{ match: null, uri: "https://accounts.google.com" }] },
		}),
		login({
			name: "Netflix",
			folderId: folders.Perso,
			login: { username: "jean.dupont@gmail.com", password: "netflix-and-chill", uris: [{ match: null, uri: "https://www.netflix.com" }] },
		}),
		login({
			name: "Amazon",
			folderId: folders.Perso,
			login: { username: "jean.dupont@gmail.com", password: "Amz-2026-xY!", uris: [{ match: null, uri: "https://www.amazon.fr" }] },
		}),
		login({
			name: "Banque Populaire",
			folderId: folders.Finances,
			reprompt: 1,
			login: { username: "12345678", password: "BP-0099-secret", uris: [{ match: null, uri: "https://www.banquepopulaire.fr" }] },
		}),
		login({
			name: "Proxmox",
			folderId: folders.Serveurs,
			login: { username: "root@pam", password: "pve-R00t-pass", uris: [{ match: null, uri: "https://pve.home.lan:8006" }] },
		}),
		login({
			name: "Home Assistant",
			folderId: folders.Serveurs,
			login: { username: "admin", password: "ha-Admin-2026", totp: "otpauth://totp/HA:admin?secret=KRSXG5CTMVRXEZLUKN2XAZLSOI&issuer=HA&period=30", uris: [{ match: null, uri: "https://ha.home.lan" }] },
		}),
		login({
			name: "Slack",
			folderId: folders.Travail,
			login: { username: "jean.dupont@entreprise.fr", password: "Sl4ck-Work!", uris: [{ match: null, uri: "https://entreprise.slack.com" }] },
		}),
		login({
			name: "Jira",
			folderId: folders.Travail,
			login: { username: "jdupont", password: "Jira-Pass-01", uris: [{ match: null, uri: "https://entreprise.atlassian.net" }] },
		}),
		login({ name: "Wi-Fi maison", folderId: null, login: { username: null, password: "wifi-Maison-5GHz-2026", uris: [] } }),
		{
			type: 3,
			name: "Visa perso",
			folderId: folders.Finances,
			favorite: false,
			reprompt: 0,
			notes: null,
			fields: [],
			card: { cardholderName: "JEAN DUPONT", brand: "Visa", number: "4111111111111111", expMonth: "08", expYear: "2029", code: "123" },
		},
		{
			type: 4,
			name: "Identité",
			folderId: folders.Perso,
			favorite: false,
			reprompt: 0,
			notes: null,
			fields: [],
			identity: {
				title: "M",
				firstName: "Jean",
				lastName: "Dupont",
				email: "jean.dupont@gmail.com",
				phone: "+33 6 12 34 56 78",
				address1: "12 rue de la République",
				city: "Lyon",
				postalCode: "69002",
				country: "FR",
			},
		},
		{
			type: 2,
			name: "Codes alarme",
			folderId: folders.Perso,
			favorite: false,
			reprompt: 0,
			notes: "Code entrée : 4821\nCode garage : 7310",
			fields: [],
			secureNote: { type: 0 },
		},
	];

	for (const item of items) {
		await api("POST", "/object/item", item);
	}

	console.log(`Seeded ${Object.keys(folders).length} folders and ${items.length} items for ${email}`);
} finally {
	await api("POST", "/lock").catch(() => undefined);
	const exited = new Promise((resolve) => server.once("exit", resolve));
	server.kill();
	await exited;
	fs.rmSync(appDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
