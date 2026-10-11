import crypto from "node:crypto";
import fs from "node:fs";
import { type BrowserWindow, dialog } from "electron";
import { inject, injectable } from "inversify";
import { LogModule } from "../log.module";
import { I18nModule } from "../i18n/i18n.module";
import { log } from "@main/utils/logs.utils";
import { convertSshKey, generateSshKey, type SshKeyMaterial } from "./ssh.keys";
import type { SshImportResult, SshKeyPreview, SshKeySource } from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";

/** How long a generated, imported or pending key waits for its item to be saved */
const TTL_MS = 10 * 60 * 1000;
/** Largest text accepted as a key: real keys are a few kilobytes */
const MAX_KEY_BYTES = 64 * 1024;

type Entry<T> = { value: T; expiresAt: number };

/**
 * SSH keys waiting for their item to be saved. The private key never reaches the renderer: it stays here behind a
 * random token, put in the item draft. Tokens expire, are cleared on lock, and are consumed once the key is saved.
 */
@injectable()
export class SshKeyModule extends LogModule {
	/** Converted keys (unencrypted OpenSSH), by token */
	private readonly ready = new Map<string, Entry<SshKeyMaterial>>();
	/** Encrypted keys waiting for their passphrase, by token: the raw text, never sent to the renderer */
	private readonly pending = new Map<string, Entry<string>>();

	public constructor(@inject(I18nModule) private readonly i18nModule: I18nModule) {
		super("SshKeyModule");
	}

	/**
	 * New Ed25519 key, held until it is saved
	 */
	@log("info")
	public generate(): SshKeyPreview {
		return this.holdKey(generateSshKey());
	}

	/**
	 * Converts a key chosen in a file dialog, pasted by the user, or waiting for its passphrase.
	 * An encrypted key without passphrase answers `passphrase-required` with a token to import again with the passphrase.
	 */
	@log("info")
	public async import(source: SshKeySource, passphrase: string | null, window: BrowserWindow | null): Promise<SshImportResult> {
		this.prune();

		let text: string;
		let pendingToken: string | null = null;

		if (source.kind === "pending") {
			const entry = this.pending.get(source.token);
			if (!entry) return { status: "error", message: appMessage("sshImportExpired") };
			text = entry.value;
			pendingToken = source.token;
		} else if (source.kind === "text") {
			text = source.text;
		} else {
			const file = await this.readFile(window);
			if (typeof file !== "string") return file;
			text = file;
		}

		if (Buffer.byteLength(text) > MAX_KEY_BYTES) return { status: "error", message: appMessage("sshKeyTooLarge") };

		const result = convertSshKey(text, passphrase || null);
		if ("error" in result) {
			if (result.error === "passphrase-required") {
				// The same pending token is kept when the passphrase was asked before
				const token = pendingToken ?? this.holdPending(text);
				return { status: "passphrase-required", token };
			}
			// A wrong passphrase keeps the pending key for another try; any other failure ends it
			if (pendingToken && result.error !== "wrong-passphrase") this.pending.delete(pendingToken);
			return { status: "error", message: result.message };
		}

		if (pendingToken) this.pending.delete(pendingToken);
		this.logger.info(`SSH key imported (${result.keyType})`);
		return { status: "success", key: this.holdKey(result) };
	}

	/**
	 * Key behind a token, without consuming it: the item is checked before it is written
	 */
	public peek(token: string): SshKeyMaterial | null {
		this.prune();
		return this.ready.get(token)?.value ?? null;
	}

	/**
	 * Key behind a token, removed: called once the item holding it has been saved
	 */
	public take(token: string): SshKeyMaterial | null {
		const material = this.peek(token);
		this.ready.delete(token);
		return material;
	}

	/**
	 * Forgets every key (lock, logout)
	 */
	public clear() {
		this.ready.clear();
		this.pending.clear();
	}

	/**
	 * Holds a converted key, or a raw text waiting for its passphrase, until they expire
	 */
	private holdKey(material: SshKeyMaterial): SshKeyPreview {
		const token = crypto.randomUUID();
		this.ready.set(token, { value: material, expiresAt: Date.now() + TTL_MS });
		return { token, keyType: material.keyType, publicKey: material.publicKey, keyFingerprint: material.keyFingerprint };
	}

	private holdPending(text: string): string {
		const token = crypto.randomUUID();
		this.pending.set(token, { value: text, expiresAt: Date.now() + TTL_MS });
		return token;
	}

	/** Drops the expired entries */
	private prune() {
		const now = Date.now();
		for (const map of [this.ready, this.pending]) {
			for (const [token, entry] of map) {
				if (entry.expiresAt < now) map.delete(token);
			}
		}
	}

	/**
	 * Text of a key file chosen by the user, or the result to answer when there is none
	 */
	private async readFile(window: BrowserWindow | null): Promise<string | SshImportResult> {
		const options: Electron.OpenDialogOptions = {
			title: await this.i18nModule.t("importSshKeyTitle"),
			properties: ["openFile"],
			filters: [{ name: await this.i18nModule.t("allFilesFilter"), extensions: ["*"] }],
		};
		const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
		if (result.canceled || result.filePaths.length === 0) return { status: "cancelled" };

		const file = result.filePaths[0];
		if (fs.statSync(file).size > MAX_KEY_BYTES) return { status: "error", message: appMessage("sshKeyTooLarge") };
		return fs.readFileSync(file, "utf-8");
	}
}
