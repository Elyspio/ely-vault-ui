/**
 * A server certificate that the system does not trust, as shown to the user before approving it
 */
export type CertificateInfo = {
	/** host:port of the server */
	host: string;
	/** Certificate presented by the server */
	subject: string;
	issuer: string;
	validTo: string;
	/** Certificate to approve: the root authority of the chain, or the server certificate when self-signed */
	anchor: {
		subject: string;
		fingerprint256: string;
		validTo: string;
	};
	/** Subjects from the server certificate to the anchor, intermediates downloaded through AIA included */
	chain: string[];
	/** Why the system refused it, in French */
	reason: string;
	/** Approving the anchor fixes the error (false: wrong host name, expired, or incomplete chain) */
	trustable: boolean;
};

export type TrustedCertificate = {
	/** Server it was approved for, null when imported from a file */
	host: string | null;
	subject: string;
	fingerprint256: string;
	validTo: string;
	addedAt: string;
};

export type CertificateCheck = { status: "trusted" } | { status: "untrusted"; certificate: CertificateInfo } | { status: "unreachable"; message: string };
