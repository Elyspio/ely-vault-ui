import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { inject, injectable } from "inversify";
import { MainContextModule } from "../context/main.context.module";
import { LogModule } from "../log.module";
import { ConfigModule } from "../config/config.module";
import type { BwStatus } from "../bitwarden/bw.types";
import type { VaultAccessBlock } from "@shared/types/vault.types";
import { appMessage } from "@shared/i18n/message";
import { offlineAccessMs } from "@shared/config/app.config";

/** Longest offline window; `security.offlineAccessMinutes` can only shorten it */
export const OFFLINE_ACCESS_MS = 24 * 60 * 60_000;
export const VAULT_SYNC_INTERVAL_MS = 15 * 60_000;

type AccessRecord = { account: string; verifiedAt: number | null; observedAt: number; rejected: boolean };

/** Local access lease, independent of the CLI's cache timestamps and renderer settings. */
@injectable()
export class OfflineAccessModule extends LogModule {
	private account: string | null = null;
	private record: AccessRecord | null = null;
	private monotonicDeadline: number | null = null;
	private observedTime = 0;
	private limitMs = OFFLINE_ACCESS_MS;

	public constructor(
		@inject(MainContextModule) private readonly context: MainContextModule,
		@inject(ConfigModule) private readonly configModule: ConfigModule
	) {
		super("OfflineAccessModule");
	}

	/** Reads the configured window (capped at 24 hours); called before an account is selected */
	public async loadLimit() {
		const limitMs = offlineAccessMs((await this.configModule.getConfig()).security.offlineAccessMinutes);
		if (limitMs === this.limitMs) return;
		this.limitMs = limitMs;
		// A deadline computed with the previous window is recomputed on the next selection
		this.account = null;
	}

	private get storePath() {
		return path.join(this.context.appFolder, "offline-access.json");
	}

	public select(status: BwStatus["template"]) {
		const account = accountKey(status);
		if (account === this.account) return;
		this.account = account;
		this.record = null;
		this.monotonicDeadline = null;
		this.observedTime = 0;
		try {
			const record: unknown = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
			if (isAccessRecord(record) && record.account === account) this.record = record;
		} catch {
			// Missing or malformed evidence never creates a lease.
		}
		if (this.record && this.record.verifiedAt !== null) {
			this.monotonicDeadline = performance.now() + Math.max(0, this.limitMs - (Date.now() - this.record.verifiedAt));
		}
	}

	public matches(status: BwStatus["template"]) {
		return this.account !== null && this.account === accountKey(status);
	}

	public get block(): VaultAccessBlock | undefined {
		if (this.record?.rejected) return "authentication-required";
		const now = Date.now();
		if (!this.record || this.record.verifiedAt === null) return "offline-expired";
		if (now < Math.max(this.record.observedAt, this.observedTime) || now < this.record.verifiedAt) {
			this.record.verifiedAt = null;
			try {
				this.persist();
			} catch {
				this.logger.warn("Could not persist invalid access evidence");
			}
			return "offline-expired";
		}
		this.observedTime = now;
		if (now - this.record.verifiedAt >= this.limitMs || (this.monotonicDeadline !== null && performance.now() >= this.monotonicDeadline)) {
			this.record.verifiedAt = null;
			try {
				this.persist();
			} catch {
				this.logger.warn("Could not persist expired access evidence");
			}
			return "offline-expired";
		}
		return undefined;
	}

	public get remainingMs() {
		if (this.block || !this.record?.verifiedAt) return 0;
		return Math.max(0, Math.min(this.record.verifiedAt + this.limitMs - Date.now(), (this.monotonicDeadline ?? Infinity) - performance.now()));
	}

	/** Persist clock observations across restarts, without changing the verification time. */
	public observe(force = false) {
		if (this.block || !this.record) return;
		if (!force && Date.now() - this.record.observedAt < 60_000) return;
		this.record.observedAt = Date.now();
		this.persist();
	}

	/** Called only after an explicit successful login, before its mandatory sync. */
	public authenticated() {
		this.replace(null, false);
	}

	public verified() {
		if (this.record?.rejected) throw new Error(appMessage("vaultAuthenticationRequired"));
		this.replace(Date.now(), false);
		this.monotonicDeadline = performance.now() + this.limitMs;
	}

	public reject() {
		this.replace(null, true);
	}

	private replace(verifiedAt: number | null, rejected: boolean) {
		if (!this.account) throw new Error(appMessage("vaultOfflineExpired"));
		this.record = { account: this.account, verifiedAt, observedAt: Date.now(), rejected };
		this.observedTime = Date.now();
		this.persist();
	}

	private persist() {
		try {
			// Rename keeps a crash during writing from leaving partially valid evidence.
			fs.writeFileSync(`${this.storePath}.tmp`, JSON.stringify(this.record), { mode: 0o600 });
			fs.renameSync(`${this.storePath}.tmp`, this.storePath);
		} catch (error) {
			if (this.record) this.record.verifiedAt = null;
			throw error;
		}
	}
}

function accountKey(status: BwStatus["template"]) {
	const user = status.userId || status.userEmail?.trim().toLowerCase();
	return status.serverUrl && user
		? crypto
				.createHash("sha256")
				.update(JSON.stringify([status.serverUrl.replace(/\/+$/, ""), user]))
				.digest("hex")
		: null;
}

function isAccessRecord(value: unknown): value is AccessRecord {
	if (!value || typeof value !== "object") return false;
	const record = value as Partial<AccessRecord>;
	return (
		typeof record.account === "string" &&
		typeof record.rejected === "boolean" &&
		typeof record.observedAt === "number" &&
		Number.isFinite(record.observedAt) &&
		record.observedAt > 0 &&
		(record.verifiedAt === null ||
			(typeof record.verifiedAt === "number" && Number.isFinite(record.verifiedAt) && record.verifiedAt > 0 && record.verifiedAt <= record.observedAt))
	);
}
