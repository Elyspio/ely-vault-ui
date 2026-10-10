import { ipcRendererWrapper } from "./preload.ipc.wrapper";
import type { AppConfig } from "@shared/config/app.config";
import type { CopyRef, LoginRequest, SecretRef } from "@shared/types/vault.types";

export function getIpcSender() {
	return {
		app: {
			close: () => ipcRendererWrapper.invoke("app:close"),
			openExternal: (url: string) => ipcRendererWrapper.invoke("app:open-external", url),
			screen: {
				minimize: () => ipcRendererWrapper.invoke("app:screen:minimize"),
				toggleFullScreen: () => ipcRendererWrapper.invoke("app:screen:toggle-fullscreen"),
				isFullScreen: () => ipcRendererWrapper.invoke("app:screen:is-fullscreen"),
			},
		},
		config: {
			get: () => ipcRendererWrapper.invoke("config:get"),
			set: (config: AppConfig) => ipcRendererWrapper.invoke("config:set", config),
		},
		session: {
			state: () => ipcRendererWrapper.invoke("session:state:get"),
			login: (request: LoginRequest) => ipcRendererWrapper.invoke("session:login", request),
			cancelLogin: () => ipcRendererWrapper.invoke("session:login:cancel"),
			unlock: (password: string) => ipcRendererWrapper.invoke("session:unlock", password),
			lock: () => ipcRendererWrapper.invoke("session:lock"),
			logout: () => ipcRendererWrapper.invoke("session:logout"),
		},
		vault: {
			snapshot: () => ipcRendererWrapper.invoke("vault:snapshot:get"),
			sync: () => ipcRendererWrapper.invoke("vault:sync"),
			secret: (itemId: string, ref: SecretRef) => ipcRendererWrapper.invoke("vault:secret:get", itemId, ref),
			copy: (itemId: string | null, ref: CopyRef) => ipcRendererWrapper.invoke("vault:copy", itemId, ref),
			totp: (itemId: string) => ipcRendererWrapper.invoke("vault:totp:get", itemId),
			verifyReprompt: (password: string) => ipcRendererWrapper.invoke("vault:reprompt:verify", password),
			icon: (host: string) => ipcRendererWrapper.invoke("vault:icon:get", host),
			generatePassword: (length: number) => ipcRendererWrapper.invoke("vault:generate-password", length),
		},
		autoType: {
			availability: () => ipcRendererWrapper.invoke("autotype:availability"),
			perform: (itemId: string) => ipcRendererWrapper.invoke("autotype:perform", itemId),
		},
		certificate: {
			trust: (fingerprint256: string) => ipcRendererWrapper.invoke("certificate:trust", fingerprint256),
			import: () => ipcRendererWrapper.invoke("certificate:import"),
			list: () => ipcRendererWrapper.invoke("certificate:list"),
			remove: (fingerprint256: string) => ipcRendererWrapper.invoke("certificate:remove", fingerprint256),
		},
	};
}

export type PreloadExposedIpc = ReturnType<typeof getIpcSender>;
