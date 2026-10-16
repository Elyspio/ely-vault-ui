import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, nativeTheme } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import type { IpcHandledEvents } from "@shared/ipc/ipc.handled.events";
import { mainContainer } from "@main/di/container.di";
import { ConfigModule } from "@main/modules/config/config.module";
import { VaultModule } from "@main/modules/vault/vault.module";
import { WindowModule } from "@main/modules/window/window.module";
import { LogModule } from "@main/modules/log.module";
import { CertificateModule } from "@main/modules/security/certificate.module";
import { HelloUnlockModule } from "@main/modules/security/hello-unlock.module";
import { SshKeyModule } from "@main/modules/vault/ssh.key.module";
import { TotpQrModule } from "@main/modules/vault/totp.qr.module";
import { BwServeModule } from "@main/modules/bitwarden/bw.serve.module";
import { AutoTypeModule } from "@main/modules/autotype/autotype.module";
import { UpdateModule } from "@main/modules/update/update.module";

const ipcHandlers: IpcHandledEvents = {
	"app:close"(event) {
		BrowserWindow.fromWebContents(event.sender)?.close();
	},
	"app:screen:minimize"(event) {
		BrowserWindow.fromWebContents(event.sender)?.minimize();
	},
	"app:screen:toggle-fullscreen"(event) {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win?.isMaximized()) win.unmaximize();
		else win?.maximize();
	},
	"app:screen:is-fullscreen"(event) {
		return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
	},
	async "app:open-external"(_, url) {
		await mainContainer.get(WindowModule).openExternal(url);
	},
	async "config:get"() {
		return await mainContainer.get(ConfigModule).getConfig();
	},
	async "config:set"(_, config) {
		// The window bounds are owned by the main process
		const { window, updates } = await mainContainer.get(ConfigModule).getConfig();
		await mainContainer.get(ConfigModule).writeConfig({ ...config, window });
		await mainContainer.get(VaultModule).onAccessLimitChanged();
		nativeTheme.themeSource = config.display.theme;
		await mainContainer.get(UpdateModule).onSettingsChanged(updates, config.updates);
	},
	async "session:state:get"() {
		return await mainContainer.get(VaultModule).getState();
	},
	async "session:login"(_, request) {
		const result = await mainContainer.get(VaultModule).login(request);
		if (result.status === "success") await mainContainer.get(HelloUnlockModule).rememberOffer(request.password);
		return result;
	},
	async "session:login:cancel"() {
		mainContainer.get(VaultModule).cancelLogin();
	},
	async "session:unlock"(_, password) {
		const result = await mainContainer.get(VaultModule).unlock(password);
		if (result.status === "success") await mainContainer.get(HelloUnlockModule).rememberOffer(password);
		return result;
	},
	async "session:lock"() {
		await mainContainer.get(VaultModule).lock();
	},
	async "session:logout"() {
		await mainContainer.get(HelloUnlockModule).forget();
		await mainContainer.get(VaultModule).logout();
	},
	async "session:hello:status"() {
		return await mainContainer.get(HelloUnlockModule).getStatus();
	},
	async "session:hello:enable"(_, password) {
		return await mainContainer.get(HelloUnlockModule).enable(password);
	},
	async "session:hello:offer"() {
		return mainContainer.get(HelloUnlockModule).hasOffer();
	},
	async "session:hello:decline"() {
		await mainContainer.get(HelloUnlockModule).declineOffer();
	},
	async "session:hello:disable"() {
		await mainContainer.get(HelloUnlockModule).disable();
	},
	async "session:hello:unlock"() {
		return await mainContainer.get(HelloUnlockModule).unlock();
	},
	async "vault:snapshot:get"() {
		return await mainContainer.get(VaultModule).getSnapshot();
	},
	async "vault:sync"() {
		return await mainContainer.get(VaultModule).sync();
	},
	async "vault:secret:get"(_, itemId, ref) {
		return await mainContainer.get(VaultModule).getSecret(itemId, ref);
	},
	async "vault:copy"(_, itemId, ref) {
		await mainContainer.get(VaultModule).copy(itemId, ref);
	},
	async "vault:totp:get"(_, itemId) {
		return await mainContainer.get(VaultModule).getTotp(itemId);
	},
	async "vault:totp:read-qr"() {
		return await mainContainer.get(TotpQrModule).readFromClipboard();
	},
	async "vault:reprompt:verify"(_, password) {
		return mainContainer.get(VaultModule).verifyReprompt(password);
	},
	async "vault:icon:get"(_, host) {
		return await mainContainer.get(VaultModule).getIcon(host);
	},
	async "vault:generate-password"(_, options) {
		return await mainContainer.get(VaultModule).generatePassword(options);
	},
	async "vault:item:create"(_, draft) {
		return await mainContainer.get(VaultModule).createItem(draft);
	},
	async "vault:item:update"(_, itemId, expectedRevision, draft) {
		return await mainContainer.get(VaultModule).updateItem(itemId, expectedRevision, draft);
	},
	async "vault:item:delete"(_, itemId) {
		return await mainContainer.get(VaultModule).deleteItem(itemId);
	},
	async "vault:item:restore"(_, itemId) {
		return await mainContainer.get(VaultModule).restoreItem(itemId);
	},
	async "vault:item:purge"(_, itemIds) {
		return await mainContainer.get(VaultModule).purgeItems(itemIds);
	},
	async "vault:item:favorite"(_, itemId, favorite) {
		return await mainContainer.get(VaultModule).setFavorite(itemId, favorite);
	},
	async "vault:item:move"(_, itemId, folderId) {
		return await mainContainer.get(VaultModule).moveItem(itemId, folderId);
	},
	async "vault:folder:create"(_, name) {
		return await mainContainer.get(VaultModule).createFolder(name);
	},
	async "vault:folder:rename"(_, path, newPath) {
		return await mainContainer.get(VaultModule).renameFolder(path, newPath);
	},
	async "vault:folder:delete"(_, folderId) {
		return await mainContainer.get(VaultModule).deleteFolder(folderId);
	},
	async "vault:ssh:generate"() {
		return mainContainer.get(SshKeyModule).generate();
	},
	async "vault:ssh:import"(event, source, passphrase) {
		return await mainContainer.get(SshKeyModule).import(source, passphrase, BrowserWindow.fromWebContents(event.sender));
	},
	async "autotype:availability"() {
		return await mainContainer.get(AutoTypeModule).getAvailability();
	},
	async "autotype:perform"(_, itemId) {
		await mainContainer.get(AutoTypeModule).perform(itemId);
	},
	async "certificate:trust"(_, fingerprint256) {
		await mainContainer.get(CertificateModule).trust(fingerprint256);
	},
	async "certificate:import"(event) {
		return await mainContainer.get(CertificateModule).importAuthority(BrowserWindow.fromWebContents(event.sender));
	},
	async "certificate:list"() {
		return mainContainer.get(CertificateModule).list();
	},
	async "certificate:remove"(_, fingerprint256) {
		mainContainer.get(CertificateModule).remove(fingerprint256);
		// The CLI reads its authorities at start: lock and restart it
		if (mainContainer.get(VaultModule).isUnlocked) await mainContainer.get(VaultModule).lock();
		await mainContainer.get(BwServeModule).stop();
		await mainContainer.get(VaultModule).notifyState();
	},
	"update:status:get"() {
		return mainContainer.get(UpdateModule).getStatus();
	},
	async "update:check"() {
		await mainContainer.get(UpdateModule).check();
	},
	async "update:download"() {
		await mainContainer.get(UpdateModule).download();
	},
	async "update:quit-and-install"() {
		await mainContainer.get(UpdateModule).quitAndInstall();
	},
};

/**
 * Only the application's own page may call the main process
 */
function isTrustedSender(event: IpcMainInvokeEvent) {
	const url = event.senderFrame?.url;
	if (!url) return false;

	const devUrl = mainContainer.get(WindowModule).rendererUrl;
	if (devUrl) return url.startsWith(devUrl);

	return url === pathToFileURL(join(__dirname, "../renderer/index.html")).toString();
}

export function registerIpcHandlers() {
	const logger = LogModule.create("IpcHandler");

	for (const channel of Object.keys(ipcHandlers) as (keyof IpcHandledEvents)[]) {
		const handler = ipcHandlers[channel] as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
		ipcMain.handle(channel, (event, ...args) => {
			if (!isTrustedSender(event)) {
				logger.error(`Refused IPC ${channel} from ${event.senderFrame?.url}`);
				throw new Error("Untrusted sender");
			}
			return handler(event, ...args);
		});
	}
}
