import { injectable } from "inversify";
import type { LoginRequest } from "@shared/types/vault.types";

@injectable()
export class SessionService {
	public state() {
		return window.preload.ipc.send.session.state();
	}

	public login(request: LoginRequest) {
		return window.preload.ipc.send.session.login(request);
	}

	public cancelLogin() {
		return window.preload.ipc.send.session.cancelLogin();
	}

	public unlock(password: string) {
		return window.preload.ipc.send.session.unlock(password);
	}

	public lock() {
		return window.preload.ipc.send.session.lock();
	}

	public logout() {
		return window.preload.ipc.send.session.logout();
	}
}
