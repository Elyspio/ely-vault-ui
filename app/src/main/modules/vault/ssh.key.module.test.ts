import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SshKeyModule } from "./ssh.key.module";

const showOpenDialog = vi.fn();

vi.mock("electron", () => ({
	dialog: { showOpenDialog: (...args: unknown[]) => showOpenDialog(...args) },
}));

// Logs go to winston and the app folder: the module only needs a logger object here
vi.mock("../log.module", () => ({
	LogModule: class {
		public logger = { info: () => undefined, debug: () => undefined, warn: () => undefined, error: () => undefined };
	},
}));

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
const ENCRYPTED_FINGERPRINT = "SHA256:v89vPZA6CQCSbOupxiedrsJneMZ7KlRCi/VEth7CzXo";

const TEN_MINUTES = 10 * 60 * 1000;

afterEach(() => {
	vi.useRealTimers();
	showOpenDialog.mockReset();
});

describe("SshKeyModule", () => {
	it("holds a generated key behind a token, until it is taken", () => {
		const module = new SshKeyModule();
		const preview = module.generate();

		expect(preview).toMatchObject({ keyType: "ssh-ed25519", publicKey: expect.stringMatching(/^ssh-ed25519 /), keyFingerprint: expect.stringMatching(/^SHA256:/) });
		expect(Object.keys(preview).sort()).toEqual(["keyFingerprint", "keyType", "publicKey", "token"]);

		// Checked before the write, then consumed by it
		expect(module.peek(preview.token)?.publicKey).toBe(preview.publicKey);
		expect(module.take(preview.token)?.publicKey).toBe(preview.publicKey);
		expect(module.take(preview.token)).toBeNull();
	});

	it("forgets every key on clear", () => {
		const module = new SshKeyModule();
		const preview = module.generate();

		module.clear();

		expect(module.peek(preview.token)).toBeNull();
	});

	it("lets a held key expire after ten minutes", () => {
		vi.useFakeTimers();
		const module = new SshKeyModule();
		const preview = module.generate();

		vi.advanceTimersByTime(TEN_MINUTES - 1000);
		expect(module.peek(preview.token)).not.toBeNull();

		vi.advanceTimersByTime(2000);
		expect(module.peek(preview.token)).toBeNull();
	});

	it("converts pasted text with its passphrase, and holds the key for the draft", async () => {
		const module = new SshKeyModule();

		const result = await module.import({ kind: "text", text: ENCRYPTED_OPENSSH }, ENCRYPTED_PASSPHRASE, null);
		expect(result.status).toBe("success");
		if (result.status !== "success") return;
		expect(result.key).toMatchObject({ keyType: "ssh-ed25519", keyFingerprint: ENCRYPTED_FINGERPRINT });
		expect(module.take(result.key.token)?.keyFingerprint).toBe(ENCRYPTED_FINGERPRINT);
	});

	it("asks the passphrase of an encrypted key, then converts it from its pending token", async () => {
		const module = new SshKeyModule();

		const asked = await module.import({ kind: "text", text: ENCRYPTED_OPENSSH }, null, null);
		expect(asked.status).toBe("passphrase-required");
		if (asked.status !== "passphrase-required") return;

		const wrong = await module.import({ kind: "pending", token: asked.token }, "wrong", null);
		expect(wrong).toEqual({ status: "error", message: "Wrong passphrase" });

		// A wrong passphrase keeps the key pending
		const right = await module.import({ kind: "pending", token: asked.token }, ENCRYPTED_PASSPHRASE, null);
		expect(right.status).toBe("success");
		if (right.status !== "success") return;
		expect(right.key.keyFingerprint).toBe(ENCRYPTED_FINGERPRINT);

		// The pending text is gone once converted
		expect(await module.import({ kind: "pending", token: asked.token }, ENCRYPTED_PASSPHRASE, null)).toEqual({
			status: "error",
			message: "The key expired, import it again",
		});
	});

	it("reports a cancelled file dialog without any key", async () => {
		showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

		expect(await new SshKeyModule().import({ kind: "file" }, null, null)).toEqual({ status: "cancelled" });
	});

	it("converts a key file chosen in the dialog, and refuses a file that is too large", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elyvault-ssh-"));
		try {
			const keyFile = path.join(dir, "id_ed25519");
			fs.writeFileSync(keyFile, ENCRYPTED_OPENSSH);
			const largeFile = path.join(dir, "large");
			fs.writeFileSync(largeFile, "x".repeat(70 * 1024));

			showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [largeFile] });
			expect(await new SshKeyModule().import({ kind: "file" }, null, null)).toEqual({ status: "error", message: "This is too large to be an SSH key" });

			showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [keyFile] });
			const asked = await new SshKeyModule().import({ kind: "file" }, null, null);
			expect(asked.status).toBe("passphrase-required");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses text that is not a key, and holds nothing", async () => {
		const module = new SshKeyModule();
		const result = await module.import({ kind: "text", text: "hello" }, null, null);

		expect(result).toEqual({ status: "error", message: "Not a private key: OpenSSH, PEM or PKCS#8 format expected" });
	});
});
