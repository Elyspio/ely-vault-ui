import { CancellationToken, type CustomPublishOptions, type GithubOptions, newError, parseXml } from "builder-util-runtime";
import type { AppUpdater } from "electron-updater";
import { computeReleaseNotes, GitHubProvider } from "electron-updater/out/providers/GitHubProvider";
import { parseUpdateInfo, type ProviderRuntimeOptions } from "electron-updater/out/providers/Provider";
import { newUrlFromBase } from "electron-updater/out/util";
import type { UpdateChannel } from "@shared/config/app.config";
import { pickReleaseTag } from "./update.status";

type ReleaseInfo = Awaited<ReturnType<GitHubProvider["getLatestVersion"]>>;

const tagRegExp = /\/tag\/(v?[^/]+)$/;

/**
 * Update provider of electron-updater (custom provider) reading the GitHub releases of the repository.
 *
 * The GitHub provider only follows the releases of one prerelease channel: here a channel also follows the more stable
 * releases (dev → beta → stable) and the highest version wins ({@link pickReleaseTag}). Every release ships
 * latest*.yml (scripts/release/release.ts), downloads and SHA-512 checks are unchanged.
 */
export function releaseProvider(owner: string, repo: string, getChannel: () => UpdateChannel): CustomPublishOptions {
	class ReleaseProvider extends GitHubProvider {
		private readonly releasesPath = `/${owner}/${repo}/releases`;

		public constructor(
			options: CustomPublishOptions,
			private readonly appUpdater: AppUpdater,
			runtimeOptions: ProviderRuntimeOptions
		) {
			super({ ...options, provider: "github", owner, repo } satisfies GithubOptions, appUpdater, runtimeOptions);
		}

		public override async getLatestVersion(): Promise<ReleaseInfo> {
			const cancellationToken = new CancellationToken();
			const feedXml = await this.httpRequest(
				newUrlFromBase(`${this.releasesPath}.atom`, this.baseUrl),
				{ accept: "application/xml, application/atom+xml, text/xml, */*" },
				cancellationToken
			);
			const feed = parseXml(feedXml ?? "");
			const releases = feed.getElements("entry").flatMap((entry) => {
				const tag = tagRegExp.exec(entry.element("link").attribute("href"))?.[1];
				return tag ? [{ tag, entry }] : [];
			});

			const tag = pickReleaseTag(
				releases.map((release) => release.tag),
				getChannel()
			);
			const release = releases.find((candidate) => candidate.tag === tag);
			if (!release) throw newError("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");

			const channelFile = `${this.getDefaultChannelName()}.yml`;
			const channelFileUrl = newUrlFromBase(`${this.releasesPath}/download/${release.tag}/${channelFile}`, this.baseUrl);
			const info = parseUpdateInfo(await this.httpRequest(channelFileUrl, null, cancellationToken), channelFile, channelFileUrl);
			info.releaseName ??= release.entry.elementValueOrEmpty("title");
			info.releaseNotes ??= computeReleaseNotes(this.appUpdater.currentVersion, this.appUpdater.fullChangelog, feed, release.entry);
			return { tag: release.tag, ...info };
		}
	}

	return { provider: "custom", updateProvider: ReleaseProvider, owner, repo };
}
