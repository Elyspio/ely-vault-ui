import { ipcRendererWrapper } from "./preload.ipc.wrapper";
import type { AppConfig } from "@shared/config/app.config";
import type { CopyRef, ItemDraft, LoginRequest, PasswordGeneratorOptions, SecretRef, SshKeySource } from "@shared/types/vault.types";

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
			hello: {
				status: () => ipcRendererWrapper.invoke("session:hello:status"),
				enable: (password: string | null) => ipcRendererWrapper.invoke("session:hello:enable", password),
				offer: () => ipcRendererWrapper.invoke("session:hello:offer"),
				decline: () => ipcRendererWrapper.invoke("session:hello:decline"),
				disable: () => ipcRendererWrapper.invoke("session:hello:disable"),
				unlock: () => ipcRendererWrapper.invoke("session:hello:unlock"),
			},
		},
		vault: {
			snapshot: () => ipcRendererWrapper.invoke("vault:snapshot:get"),
			sync: () => ipcRendererWrapper.invoke("vault:sync"),
			secret: (itemId: string, ref: SecretRef) => ipcRendererWrapper.invoke("vault:secret:get", itemId, ref),
			copy: (itemId: string | null, ref: CopyRef) => ipcRendererWrapper.invoke("vault:copy", itemId, ref),
			totp: (itemId: string) => ipcRendererWrapper.invoke("vault:totp:get", itemId),
			readTotpQr: () => ipcRendererWrapper.invoke("vault:totp:read-qr"),
			verifyReprompt: (password: string) => ipcRendererWrapper.invoke("vault:reprompt:verify", password),
			icon: (host: string) => ipcRendererWrapper.invoke("vault:icon:get", host),
			generatePassword: (options: PasswordGeneratorOptions) => ipcRendererWrapper.invoke("vault:generate-password", options),
			createItem: (draft: ItemDraft) => ipcRendererWrapper.invoke("vault:item:create", draft),
			updateItem: (itemId: string, expectedRevision: string, draft: ItemDraft) => ipcRendererWrapper.invoke("vault:item:update", itemId, expectedRevision, draft),
			deleteItem: (itemId: string) => ipcRendererWrapper.invoke("vault:item:delete", itemId),
			restoreItem: (itemId: string) => ipcRendererWrapper.invoke("vault:item:restore", itemId),
			purgeItems: (itemIds: string[]) => ipcRendererWrapper.invoke("vault:item:purge", itemIds),
			setFavorite: (itemId: string, favorite: boolean) => ipcRendererWrapper.invoke("vault:item:favorite", itemId, favorite),
			moveItem: (itemId: string, folderId: string | null) => ipcRendererWrapper.invoke("vault:item:move", itemId, folderId),
			createFolder: (name: string) => ipcRendererWrapper.invoke("vault:folder:create", name),
			renameFolder: (path: string, newPath: string) => ipcRendererWrapper.invoke("vault:folder:rename", path, newPath),
			deleteFolder: (folderId: string) => ipcRendererWrapper.invoke("vault:folder:delete", folderId),
			generateSshKey: () => ipcRendererWrapper.invoke("vault:ssh:generate"),
			importSshKey: (source: SshKeySource, passphrase: string | null) => ipcRendererWrapper.invoke("vault:ssh:import", source, passphrase),
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
		update: {
			status: () => ipcRendererWrapper.invoke("update:status:get"),
			check: () => ipcRendererWrapper.invoke("update:check"),
			download: () => ipcRendererWrapper.invoke("update:download"),
			quitAndInstall: () => ipcRendererWrapper.invoke("update:quit-and-install"),
		},
	};
}

export type PreloadExposedIpc = ReturnType<typeof getIpcSender>;
