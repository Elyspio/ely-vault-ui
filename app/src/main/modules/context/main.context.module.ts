import path from "node:path";
import fs from "node:fs";
import { mainConfig } from "@shared/config/main.config";
import { is } from "@electron-toolkit/utils";
import { app } from "electron";
import { injectable } from "inversify";

@injectable()
export class MainContextModule {
	#appFolder: string = "";

	/**
	 * Application folder, in the user's local application data
	 */
	public get appFolder() {
		if (this.#appFolder) return this.#appFolder;

		const localAppData = process.env.LOCALAPPDATA || app.getPath("appData");
		this.#appFolder = path.resolve(localAppData, mainConfig.names.folder);

		if (!fs.existsSync(this.#appFolder)) fs.mkdirSync(this.#appFolder, { recursive: true });

		return this.#appFolder;
	}

	/**
	 * Data folder of the Bitwarden CLI (encrypted vault, tokens), isolated from a global `bw` installation
	 */
	public get bitwardenDataFolder() {
		const folder = path.join(this.appFolder, "bitwarden");
		if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
		return folder;
	}

	public get allowDebug() {
		const envFlag = process.env.VAULT_DEBUG;
		const cliFlag = app.commandLine.hasSwitch("debug") || app.commandLine.hasSwitch("devtools");
		const envEnabled = envFlag === "1" || envFlag?.toLowerCase() === "true";
		return is.dev || envEnabled || cliFlag;
	}
}
