import { injectable } from "inversify";

@injectable()
export class CertificateService {
	public trust(fingerprint256: string) {
		return window.preload.ipc.send.certificate.trust(fingerprint256);
	}

	public import() {
		return window.preload.ipc.send.certificate.import();
	}

	public list() {
		return window.preload.ipc.send.certificate.list();
	}

	public remove(fingerprint256: string) {
		return window.preload.ipc.send.certificate.remove(fingerprint256);
	}
}
