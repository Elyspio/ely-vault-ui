import { injectable } from "inversify";
import type { AppConfig } from "@shared/config/app.config";

@injectable()
export class ConfigService {
	public get() {
		return window.preload.ipc.send.config.get();
	}

	public set(config: AppConfig) {
		return window.preload.ipc.send.config.set(config);
	}
}
