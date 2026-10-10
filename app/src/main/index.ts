import "reflect-metadata";
import { app, BrowserWindow, Menu } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { registerIpcHandlers } from "@main/ipc/ipc.handler";
import { mainContainer } from "@main/di/container.di";
import { WindowModule } from "@main/modules/window/window.module";
import { VaultModule } from "@main/modules/vault/vault.module";
import { AutoLockModule } from "@main/modules/security/auto-lock.module";
import { UpdateModule } from "@main/modules/update/update.module";
import { mainConfig } from "@shared/config/main.config";

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
	app.quit();
}

if (hasSingleInstanceLock) {
	app.on("second-instance", () => mainContainer.get(WindowModule).focusMainWindow());

	void app.whenReady().then(async () => {
		electronApp.setAppUserModelId(mainConfig.names.appId);

		// No default menu (its Ctrl+R would reload the page); macOS keeps the edit shortcuts
		Menu.setApplicationMenu(process.platform === "darwin" ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }]) : null);
		// F12 toggles the DevTools in development, Ctrl+R reload is ignored in production
		app.on("browser-window-created", (_, window) => optimizer.watchWindowShortcuts(window));

		const windowModule = mainContainer.get(WindowModule);
		windowModule.hardenSession();
		registerIpcHandlers();

		await windowModule.createMainWindow();
		mainContainer.get(AutoLockModule).start();
		void mainContainer.get(UpdateModule).start();

		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) void windowModule.createMainWindow();
		});
	});
}

// Lock the vault, stop `bw serve` and clear the clipboard before leaving
let shutdownDone = false;
app.on("before-quit", (event) => {
	if (shutdownDone) return;
	event.preventDefault();
	mainContainer.get(AutoLockModule).stop();
	void mainContainer
		.get(VaultModule)
		.shutdown()
		.finally(() => {
			shutdownDone = true;
			app.quit();
		});
});

app.on("window-all-closed", () => {
	app.quit();
});
