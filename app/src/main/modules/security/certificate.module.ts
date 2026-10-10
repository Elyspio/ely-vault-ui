import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { X509Certificate } from "node:crypto";
import { type BrowserWindow, dialog } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { MainContextModule } from "../context/main.context.module";
import { log } from "@main/utils/logs.utils";
import type { CertificateCheck, CertificateInfo, TrustedCertificate } from "@shared/types/certificate.types";

type StoredTrust = TrustedCertificate & {
	/** Anchor and intermediates, PEM: the server may not send its intermediates */
	pems: string[];
};

const MAX_CHAIN = 6;
const BUNDLE_ENV = "VAULT_CA_BUNDLE";
const PRELOAD = `const fs = require("node:fs");
const tls = require("node:tls");
const pems = fs.readFileSync(process.env.${BUNDLE_ENV}, "utf-8").match(/-----BEGIN CERTIFICATE-----[\\s\\S]+?-----END CERTIFICATE-----/g) ?? [];
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...pems]);
`;
const TIMEOUT_MS = 8000;

/**
 * Server certificates approved by the user, for servers behind a private PKI or with a self-signed certificate.
 *
 * Nothing is trusted silently: the user approves one authority (shown with its SHA-256 fingerprint) or imports one from a file.
 * Approved certificates reach the Bitwarden CLI through a preload adding them to the default TLS authorities
 * (packaged Electron ignores NODE_EXTRA_CA_CERTS) and the Chromium network stack (favicons) through the session certificate verifier.
 */
@injectable()
export class CertificateModule extends LogModule {
	/** Chains inspected but not approved yet, by anchor fingerprint: the renderer can only approve what was really presented */
	private readonly pending = new Map<string, { host: string; chain: X509Certificate[] }>();
	private trusted: StoredTrust[] | null = null;
	/** NODE_EXTRA_CA_CERTS of the environment, kept in the bundle */
	private readonly inheritedExtraCa = process.env.NODE_EXTRA_CA_CERTS;

	public constructor(@inject(MainContextModule) private readonly mainContextModule: MainContextModule) {
		super("CertificateModule");
	}

	private get folder() {
		const folder = path.join(this.mainContextModule.appFolder, "certificates");
		if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
		return folder;
	}

	private get storePath() {
		return path.join(this.folder, "trusted.json");
	}

	private get bundleFile() {
		return path.join(this.folder, "ca-bundle.pem");
	}

	private get preloadFile() {
		return path.join(this.folder, "ca-preload.cjs");
	}

	// region Trust store

	private getStore(): StoredTrust[] {
		if (this.trusted) return this.trusted;
		try {
			this.trusted = JSON.parse(fs.readFileSync(this.storePath, "utf-8")) as StoredTrust[];
		} catch {
			this.trusted = [];
		}
		return this.trusted;
	}

	private saveStore(store: StoredTrust[]) {
		this.trusted = store;
		fs.writeFileSync(this.storePath, JSON.stringify(store, null, 4));

		const inherited = this.inheritedExtraCa && fs.existsSync(this.inheritedExtraCa) ? fs.readFileSync(this.inheritedExtraCa, "utf-8") : "";
		fs.writeFileSync(this.bundleFile, [inherited.trim(), ...store.flatMap((t) => t.pems)].filter(Boolean).join("\n") + "\n");
	}

	/**
	 * Node arguments and environment making the Bitwarden CLI trust the approved certificates (and the inherited NODE_EXTRA_CA_CERTS)
	 */
	public cliTrust(): { args: string[]; env: Record<string, string> } {
		if (this.getStore().length === 0) return { args: [], env: {} };
		fs.writeFileSync(this.preloadFile, PRELOAD);
		return { args: ["--require", this.preloadFile], env: { [BUNDLE_ENV]: this.bundleFile } };
	}

	public list(): TrustedCertificate[] {
		return this.getStore().map(({ pems: _, ...trust }) => trust);
	}

	@log("info")
	public remove(fingerprint256: string) {
		this.saveStore(this.getStore().filter((t) => t.fingerprint256 !== fingerprint256));
	}

	private trustedCertificates() {
		return this.getStore().flatMap((t) => t.pems.map((pem) => new X509Certificate(pem)));
	}

	private caList() {
		return [...tls.getCACertificates("default"), ...this.getStore().flatMap((t) => t.pems)];
	}

	// endregion

	// region Inspection

	/**
	 * Checks the TLS certificate of a server against the system authorities and the approved ones
	 */
	@log()
	public async check(serverUrl: string): Promise<CertificateCheck> {
		const url = new URL(serverUrl);
		const host = url.hostname;
		const port = Number(url.port) || 443;

		try {
			await this.handshake(host, port, true);
			return { status: "trusted" };
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code ?? "";
			if (!isCertificateError(code)) {
				return { status: "unreachable", message: (error as Error).message };
			}
			this.logger.warn(`Certificate of ${host}:${port} refused: ${code}`);
		}

		const presented = await this.handshake(host, port, false);
		const chain = await this.completeChain(presented);
		return { status: "untrusted", certificate: this.describe(`${host}:${port}`, host, chain) };
	}

	/**
	 * Approves the anchor of a chain inspected by {@link check}, then checks the server is now trusted
	 */
	@log("info")
	public async trust(fingerprint256: string) {
		const pending = this.pending.get(fingerprint256);
		if (!pending) throw new Error("Certificat inconnu : relancez la connexion");

		const [leaf, ...authorities] = pending.chain;
		const anchor = pending.chain.at(-1)!;
		// A self-signed server certificate is its own anchor
		const pems = (authorities.length > 0 ? authorities : [leaf]).map((c) => c.toString());

		const previous = this.getStore();
		this.saveStore([
			...previous.filter((t) => t.fingerprint256 !== fingerprint256),
			{ host: pending.host, subject: commonName(anchor.subject), fingerprint256, validTo: new Date(anchor.validTo).toISOString(), addedAt: new Date().toISOString(), pems },
		]);
		this.pending.delete(fingerprint256);

		const [hostname, port] = pending.host.split(/:(?=\d+$)/);
		try {
			await this.handshake(hostname, Number(port), true);
		} catch (error) {
			this.saveStore(previous);
			throw new Error(`Le serveur reste non approuvé : ${(error as Error).message}`);
		}
	}

	/**
	 * Imports authority certificates (PEM or DER) chosen by the user
	 */
	@log("info")
	public async importAuthority(window: BrowserWindow | null): Promise<TrustedCertificate[]> {
		const options: Electron.OpenDialogOptions = {
			title: "Importer un certificat d'autorité",
			properties: ["openFile"],
			filters: [{ name: "Certificats", extensions: ["pem", "crt", "cer", "der"] }],
		};
		const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
		if (result.canceled || result.filePaths.length === 0) return [];

		const certificates = parseCertificates(fs.readFileSync(result.filePaths[0]));
		if (certificates.length === 0) throw new Error("Aucun certificat dans ce fichier");
		const notAuthority = certificates.find((c) => !c.ca);
		if (notAuthority) throw new Error(`« ${commonName(notAuthority.subject)} » n'est pas un certificat d'autorité`);

		const added: StoredTrust[] = certificates.map((c) => ({
			host: null,
			subject: commonName(c.subject),
			fingerprint256: c.fingerprint256,
			validTo: new Date(c.validTo).toISOString(),
			addedAt: new Date().toISOString(),
			pems: [c.toString()],
		}));
		const fingerprints = new Set(added.map((t) => t.fingerprint256));
		this.saveStore([...this.getStore().filter((t) => !fingerprints.has(t.fingerprint256)), ...added]);

		return added.map(({ pems: _, ...trust }) => trust);
	}

	/**
	 * Chromium certificate check for the approved authorities (used for favicons): the leaf must chain to an approved root
	 */
	public isApprovedForChromium(hostname: string, leafPem: string): boolean {
		try {
			const leaf = new X509Certificate(leafPem);
			if (!isValidNow(leaf) || !matchesHost(leaf, hostname)) return false;

			const trusted = this.trustedCertificates();
			if (trusted.some((c) => c.fingerprint256 === leaf.fingerprint256)) return true;

			let current = leaf;
			for (let depth = 0; depth < MAX_CHAIN; depth++) {
				const issuer = trusted.find((c) => c.subject === current.issuer && current.verify(c.publicKey));
				if (!issuer) return false;
				if (isSelfSigned(issuer)) return true;
				current = issuer;
			}
		} catch {
			// Unparsable certificate: Chromium's own verdict applies
		}
		return false;
	}

	private handshake(host: string, port: number, verify: true): Promise<void>;
	private handshake(host: string, port: number, verify: false): Promise<X509Certificate[]>;
	private handshake(host: string, port: number, verify: boolean): Promise<X509Certificate[] | void> {
		return new Promise((resolve, reject) => {
			const socket = tls.connect({
				host,
				port,
				servername: net.isIP(host) ? undefined : host,
				rejectUnauthorized: verify,
				ca: verify ? this.caList() : undefined,
				timeout: TIMEOUT_MS,
			});
			socket.once("secureConnect", () => {
				const chain = verify ? undefined : presentedChain(socket.getPeerCertificate(true));
				socket.end();
				resolve(chain);
			});
			socket.once("timeout", () => socket.destroy(new Error(`Délai dépassé pour ${host}:${port}`)));
			socket.once("error", reject);
		});
	}

	/**
	 * Servers often send their certificate alone: download the missing authorities from the AIA urls.
	 * Each downloaded certificate must have signed the previous one, so the transport does not need to be trusted.
	 */
	private async completeChain(chain: X509Certificate[]): Promise<X509Certificate[]> {
		const result = [...chain];

		while (result.length < MAX_CHAIN && !isSelfSigned(result.at(-1)!)) {
			const current = result.at(-1)!;
			let issuer: X509Certificate | undefined;

			for (const url of aiaUrls(current)) {
				try {
					issuer = parseCertificates(await download(url)).find((c) => c.subject === current.issuer && current.verify(c.publicKey));
				} catch (error) {
					this.logger.warn(`AIA download failed: ${url}`, (error as Error).message);
				}
				if (issuer) break;
			}

			if (!issuer) break;
			result.push(issuer);
		}

		return result;
	}

	private describe(hostPort: string, hostname: string, chain: X509Certificate[]): CertificateInfo {
		const leaf = chain[0];
		const anchor = chain.at(-1)!;
		const hostOk = matchesHost(leaf, hostname);
		const valid = chain.every(isValidNow);
		const complete = isSelfSigned(anchor);

		let reason: string;
		if (!hostOk) reason = `Le certificat n'est pas émis pour ${hostname}`;
		else if (!valid) reason = "Un certificat de la chaîne est expiré ou pas encore valide";
		else if (!complete) reason = "L'autorité racine est introuvable : importez son certificat";
		else if (chain.length === 1) reason = "Certificat auto-signé";
		else reason = `Autorité « ${commonName(anchor.subject)} » inconnue de ce poste`;

		const trustable = hostOk && valid && complete;
		if (trustable) this.pending.set(anchor.fingerprint256, { host: hostPort, chain });

		return {
			host: hostPort,
			subject: commonName(leaf.subject),
			issuer: commonName(leaf.issuer),
			validTo: new Date(leaf.validTo).toISOString(),
			anchor: { subject: commonName(anchor.subject), fingerprint256: anchor.fingerprint256, validTo: new Date(anchor.validTo).toISOString() },
			chain: chain.map((c) => commonName(c.subject)),
			reason,
			trustable,
		};
	}

	// endregion
}

function isCertificateError(code: string) {
	return /CERT|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)|ERR_TLS_CERT/.test(code);
}

function presentedChain(peer: tls.DetailedPeerCertificate): X509Certificate[] {
	const chain: X509Certificate[] = [];
	const seen = new Set<string>();
	let current: tls.DetailedPeerCertificate | undefined = peer;
	while (current?.raw && !seen.has(current.fingerprint256)) {
		seen.add(current.fingerprint256);
		chain.push(new X509Certificate(current.raw));
		current = current.issuerCertificate;
	}
	return chain;
}

function isSelfSigned(certificate: X509Certificate) {
	return certificate.subject === certificate.issuer && certificate.verify(certificate.publicKey);
}

function isValidNow(certificate: X509Certificate) {
	const now = Date.now();
	return new Date(certificate.validFrom).getTime() <= now && now <= new Date(certificate.validTo).getTime();
}

function matchesHost(certificate: X509Certificate, hostname: string) {
	return net.isIP(hostname) ? certificate.checkIP(hostname) !== undefined : certificate.checkHost(hostname) !== undefined;
}

export function commonName(distinguishedName: string) {
	return /(?:^|\n)CN=([^\n]+)/.exec(distinguishedName)?.[1] ?? distinguishedName.replaceAll("\n", ", ");
}

function aiaUrls(certificate: X509Certificate) {
	return [...(certificate.infoAccess ?? "").matchAll(/CA Issuers - URI:(https?:\/\/\S+)/g)].map((m) => m[1]);
}

/**
 * PEM (one or more blocks) or DER
 */
export function parseCertificates(content: Buffer): X509Certificate[] {
	const text = content.toString("latin1");
	const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
	if (blocks) return blocks.map((block) => new X509Certificate(block));
	try {
		return [new X509Certificate(content)];
	} catch {
		return [];
	}
}

/**
 * Downloads an authority certificate (AIA). TLS is not verified: the content is checked by signature.
 */
function download(url: string, redirects = 3): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const client = url.startsWith("https:") ? https : http;
		const request = client.get(url, { timeout: TIMEOUT_MS, rejectUnauthorized: false }, (response) => {
			const location = response.headers.location;
			if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location && redirects > 0) {
				response.resume();
				resolve(download(new URL(location, url).toString(), redirects - 1));
				return;
			}
			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error(`HTTP ${response.statusCode}`));
				return;
			}
			const chunks: Buffer[] = [];
			let size = 0;
			response.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > 256 * 1024) request.destroy(new Error("Certificate too large"));
				else chunks.push(chunk);
			});
			response.on("end", () => resolve(Buffer.concat(chunks)));
		});
		request.on("timeout", () => request.destroy(new Error("Timeout")));
		request.on("error", reject);
	});
}
