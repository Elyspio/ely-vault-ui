export const names = {
	public: "ElyVault",
	folder: "elyvault",
	appId: "fr.elyspio.elyvault.app",
};

const repository = { owner: "Elyspio", repo: "ely-vault-ui" };

export const autoUpdate = {
	/** Minutes between two update checks */
	checkDelay: 60,
	/** GitHub repository of the releases (also in config/electron-builder.yml) */
	repository,
	releasesUrl: `https://github.com/${repository.owner}/${repository.repo}/releases`,
};

export const mainConfig = {
	names,
	autoUpdate,
};
