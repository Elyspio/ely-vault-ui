import { describe, expect, it } from "vite-plus/test";
import { getHost, getSecretValue, getTotpPeriod, sanitizeItem } from "./vault.mapper";
import type { BwItem } from "../bitwarden/bw.types";
import { CipherType, FieldType, UriMatchType } from "@shared/types/vault.types";

const base: BwItem = {
	id: "item-1",
	folderId: null,
	type: CipherType.Login,
	reprompt: 0,
	name: "GitHub",
	favorite: false,
	revisionDate: "2026-10-10T12:00:00.000Z",
};

describe("sanitizeItem", () => {
	it("removes the password and TOTP seed of a login", () => {
		const item = sanitizeItem({
			...base,
			login: { username: "octocat", password: "secret-password", totp: "JBSWY3DPEHPK3PXP", passwordRevisionDate: null, uris: [{ uri: "https://github.com/login" }] },
		});

		expect(item.login).toEqual({
			username: "octocat",
			uris: [{ uri: "https://github.com/login", host: "github.com", match: null }],
			hasPassword: true,
			hasTotp: true,
			passwordRevisionDate: null,
			passkeyCount: 0,
		});
		expect(JSON.stringify(item)).not.toContain("secret-password");
		expect(JSON.stringify(item)).not.toContain("JBSWY3DPEHPK3PXP");
	});

	it("keeps only the last 4 digits of a card and drops its code", () => {
		const item = sanitizeItem({
			...base,
			type: CipherType.Card,
			card: { cardholderName: "JEAN DUPONT", brand: "Visa", number: "4111 1111 1111 1234", expMonth: "08", expYear: "2029", code: "123" },
		});

		expect(item.card).toMatchObject({ numberLast4: "1234", hasNumber: true, hasCode: true });
		expect(JSON.stringify(item)).not.toContain("4111");
		expect(JSON.stringify(item)).not.toContain('"123"');
	});

	it("hides the value of hidden custom fields only", () => {
		const item = sanitizeItem({
			...base,
			fields: [
				{ name: "Recovery code", value: "a1b2-c3d4", type: 1 },
				{ name: "Organisation", value: "elyspio", type: 0 },
			],
		});

		expect(item.fields).toEqual([
			{ name: "Recovery code", type: 1, value: null, hasValue: true, linkedId: null },
			{ name: "Organisation", type: 0, value: "elyspio", hasValue: true, linkedId: null },
		]);
	});

	it("drops the private key of an SSH key", () => {
		const item = sanitizeItem({
			...base,
			type: CipherType.SshKey,
			sshKey: { privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----", publicKey: "ssh-ed25519 AAAA", keyFingerprint: "SHA256:abc" },
		});

		expect(item.sshKey).toEqual({ publicKey: "ssh-ed25519 AAAA", keyFingerprint: "SHA256:abc", hasPrivateKey: true });
	});

	it("flags items protected by a master password reprompt", () => {
		expect(sanitizeItem({ ...base, reprompt: 1 }).reprompt).toBe(true);
	});

	it("counts the passkeys of a login without keeping them", () => {
		const item = sanitizeItem({
			...base,
			login: {
				username: "octocat",
				password: null,
				totp: null,
				passwordRevisionDate: null,
				uris: null,
				fido2Credentials: [{ credentialId: "cred-1", keyValue: "private-key-material" }, { credentialId: "cred-2" }],
			},
		});

		expect(item.login?.passkeyCount).toBe(2);
		expect(JSON.stringify(item)).not.toContain("private-key-material");
	});

	it("keeps the uri match type, null when the account default is used", () => {
		const item = sanitizeItem({
			...base,
			login: {
				username: null,
				password: null,
				totp: null,
				passwordRevisionDate: null,
				uris: [{ uri: "https://github.com", match: UriMatchType.Exact }, { uri: "https://gitlab.com", match: null }, { uri: "https://bitbucket.org" }],
			},
		});

		expect(item.login?.uris).toEqual([
			{ uri: "https://github.com", host: "github.com", match: UriMatchType.Exact },
			{ uri: "https://gitlab.com", host: "gitlab.com", match: null },
			{ uri: "https://bitbucket.org", host: "bitbucket.org", match: null },
		]);
	});

	it("exposes the deletion date of a trashed item", () => {
		expect(sanitizeItem(base).deletedDate).toBeNull();
		expect(sanitizeItem({ ...base, deletedDate: "2026-10-09T08:00:00.000Z" }).deletedDate).toBe("2026-10-09T08:00:00.000Z");
	});

	it("exposes the linked property of a linked field", () => {
		const item = sanitizeItem({
			...base,
			fields: [
				{ name: "Username", value: null, type: FieldType.Linked, linkedId: 0 },
				{ name: "Plain", value: "x", type: FieldType.Text },
			],
		});

		expect(item.fields).toEqual([
			{ name: "Username", type: FieldType.Linked, value: null, hasValue: false, linkedId: 0 },
			{ name: "Plain", type: FieldType.Text, value: "x", hasValue: true, linkedId: null },
		]);
	});
});

describe("getSecretValue", () => {
	it("reads a custom field by index", () => {
		expect(getSecretValue({ ...base, fields: [{ name: "pin", value: "0000", type: 1 }] }, { kind: "field", index: 0 })).toBe("0000");
		expect(getSecretValue(base, { kind: "field", index: 3 })).toBeNull();
	});
});

describe("getHost", () => {
	it.each([
		["https://github.com/login", "github.com"],
		["github.com", "github.com"],
		["https://pve.home.lan:8006", "pve.home.lan"],
		["androidapp://com.example", null],
		["not an uri", null],
	])("%s -> %s", (uri, host) => {
		expect(getHost(uri)).toBe(host);
	});
});

describe("getTotpPeriod", () => {
	it("reads the period of an otpauth uri and defaults to 30 s", () => {
		expect(getTotpPeriod("otpauth://totp/A:b?secret=ABC&period=60")).toBe(60);
		expect(getTotpPeriod("otpauth://totp/A:b?secret=ABC")).toBe(30);
		expect(getTotpPeriod("JBSWY3DPEHPK3PXP")).toBe(30);
		expect(getTotpPeriod("steam://ABC")).toBe(30);
	});
});
