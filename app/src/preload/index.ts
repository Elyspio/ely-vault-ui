import { contextBridge } from "electron";
import { getIpcSender, type PreloadExposedIpc } from "./parts/preload.ipc.sender";
import { getIpcReceiver, type PreloadReceivedIpc } from "./parts/preload.ipc.receiver";
import { mainConfig } from "@shared/config/main.config";

const preload = {
	ipc: {
		send: getIpcSender(),
		on: getIpcReceiver(),
	},
	config: {
		appName: mainConfig.names.public,
		releasesUrl: mainConfig.autoUpdate.releasesUrl,
		platform: process.platform,
	},
};

export type PreloadExposed = {
	ipc: {
		send: PreloadExposedIpc;
		on: PreloadReceivedIpc;
	};
	config: typeof preload.config;
};

contextBridge.exposeInMainWorld("preload", preload satisfies PreloadExposed);
