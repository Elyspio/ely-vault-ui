import { describe, expect, it } from "vite-plus/test";
import { appMessage } from "@shared/i18n/message";
import { translateMessages } from "./message.utils";

describe("IPC message translation", () => {
	it("translates result messages without rewriting vault data", () => {
		const encoded = appMessage("vaultLocked");
		const result = {
			outcome: { status: "error", message: encoded },
			refreshError: encoded,
			certificate: { reason: encoded, subject: encoded },
			snapshot: { items: [{ name: encoded, notes: encoded, fields: [{ name: "message", value: encoded }] }] },
		};
		const translated = translateMessages(result);
		expect(translated.outcome.message).toBe("The vault is locked");
		expect(translated.refreshError).toBe("The vault is locked");
		expect(translated.certificate.reason).toBe("The vault is locked");
		expect(translated.certificate.subject).toBe(encoded);
		expect(translated.snapshot).toEqual(result.snapshot);
		expect(result.outcome.message).toBe(encoded);
	});
});
