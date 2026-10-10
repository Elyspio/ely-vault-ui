/**
 * Publishes the version of package.json as a draft GitHub release, read by the auto update of the application.
 *
 * Run `pnpm release` on Windows, from an up to date `main`, with Docker or Podman and an authenticated `gh`:
 * checks the repository, builds the Windows installer locally and the Linux packages in a container,
 * pushes the tag then creates the draft release (notes generated from the merged PRs) with the artifacts.
 * The release is only seen by the applications once published from GitHub.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import semver from "semver";

export type ReleaseVersion = {
	version: string;
	tag: string;
	/** Beta versions (x.y.z-beta.n) are published as GitHub prereleases */
	prerelease: boolean;
	/** Update channel of electron-updater: latest.yml or beta.yml */
	channel: "latest" | "beta";
};

export type RepositoryState = {
	branch: string;
	dirty: boolean;
	/** HEAD is the commit of origin/main */
	upToDate: boolean;
	tags: string[];
};

/**
 * Validates the version of package.json: stable (1.2.0) or beta (1.2.0-beta.1), the only channels the application follows
 */
export function parseReleaseVersion(version: string): ReleaseVersion {
	const parsed = semver.parse(version);
	if (!parsed || parsed.build.length > 0) throw new Error(`Invalid version "${version}": expected x.y.z or x.y.z-beta.n`);

	const prerelease = parsed.prerelease;
	if (prerelease.length > 0 && (prerelease.length !== 2 || prerelease[0] !== "beta" || typeof prerelease[1] !== "number")) {
		throw new Error(`Invalid prerelease "${version}": only x.y.z-beta.n is supported by the application`);
	}

	return { version: parsed.version, tag: `v${parsed.version}`, prerelease: prerelease.length > 0, channel: prerelease.length > 0 ? "beta" : "latest" };
}

/**
 * Reasons the release cannot be made from the current repository, empty when it can
 */
export function releaseProblems(release: ReleaseVersion, repository: RepositoryState): string[] {
	const problems: string[] = [];
	if (repository.branch !== "main") problems.push(`Releases are made from main (current branch: ${repository.branch})`);
	if (repository.dirty) problems.push("The working tree has uncommitted changes");
	if (!repository.upToDate) problems.push("HEAD is not origin/main: pull or push first");
	if (repository.tags.includes(release.tag)) problems.push(`Tag ${release.tag} already exists: bump the version in package.json`);

	const latest = repository.tags
		.map((tag) => semver.valid(semver.clean(tag)))
		.filter((version): version is string => version !== null)
		.sort(semver.rcompare)[0];
	if (latest && !semver.gt(release.version, latest)) problems.push(`Version ${release.version} must be greater than the latest tag v${latest}`);

	return problems;
}

/**
 * Files uploaded to the release: installers, their blockmap and the update files of electron-updater
 */
export function releaseAssets(name: string, release: ReleaseVersion): string[] {
	const { version, channel } = release;
	return [
		`${name}-${version}-setup.exe`,
		`${name}-${version}-setup.exe.blockmap`,
		`${channel}.yml`,
		`${name}-${version}.AppImage`,
		`${name}_${version}_amd64.deb`,
		`${channel}-linux.yml`,
	];
}

const rootDir = path.resolve(import.meta.dirname, "../..");
const distDir = path.join(rootDir, "dist");
const linuxImage = "vault-desktop-release-linux";

function run(command: string, args: string[]) {
	console.log(`\n> ${command} ${args.join(" ")}`);
	return new Promise<void>((resolve, reject) => {
		// pnpm and gh are .cmd shims on Windows
		const child = spawn(command, args, { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
		child.on("error", reject);
		child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args[0] ?? ""} failed with exit code ${code}`))));
	});
}

function output(command: string, args: string[]) {
	return execFileSync(command, args, { cwd: rootDir, encoding: "utf-8" }).trim();
}

function succeeds(command: string, args: string[]) {
	try {
		execFileSync(command, args, { cwd: rootDir, stdio: "ignore", shell: process.platform === "win32" });
		return true;
	} catch {
		return false;
	}
}

function readRepository(): RepositoryState {
	output("git", ["fetch", "--tags", "origin", "main"]);
	return {
		branch: output("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
		dirty: output("git", ["status", "--porcelain"]) !== "",
		upToDate: output("git", ["rev-parse", "HEAD"]) === output("git", ["rev-parse", "origin/main"]),
		tags: output("git", ["tag", "--list", "v*"]).split("\n").filter(Boolean),
	};
}

function containerRuntime() {
	const runtime = ["docker", "podman"].find((command) => succeeds(command, ["info"]));
	if (!runtime) throw new Error("Docker or Podman must be running to build the Linux packages");
	return runtime;
}

async function main() {
	const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8")) as { name: string; version: string };
	const release = parseReleaseVersion(packageJson.version);
	console.log(`Release ${release.tag}${release.prerelease ? " (beta)" : ""}`);

	if (process.platform !== "win32") throw new Error("Releases are built from Windows: the NSIS installer is built locally");

	const problems = releaseProblems(release, readRepository());
	if (problems.length > 0) throw new Error(`Cannot release:\n- ${problems.join("\n- ")}`);
	if (!succeeds("gh", ["auth", "status"])) throw new Error("gh must be authenticated: gh auth login");
	const runtime = containerRuntime();

	await run("pnpm", ["exec", "vp", "check"]);
	await run("pnpm", ["typecheck"]);
	await run("pnpm", ["test"]);

	rmSync(path.join(rootDir, "out"), { recursive: true, force: true });
	rmSync(distDir, { recursive: true, force: true });
	mkdirSync(distDir);

	await run(runtime, ["build", "-f", "deploy/release/linux.Dockerfile", "-t", linuxImage, "."]);
	await run(runtime, ["run", "--rm", "--volume", `${distDir.replaceAll("\\", "/")}:/project/dist`, "--volume", `${linuxImage}-cache:/root/.cache`, linuxImage]);

	await run("pnpm", ["build"]);
	await run("pnpm", ["exec", "electron-builder", "--config", "config/electron-builder.yml", "--win", "nsis", "--publish", "never"]);

	const assets = releaseAssets(packageJson.name, release).map((file) => path.join(distDir, file));
	const missing = assets.filter((file) => !existsSync(file));
	if (missing.length > 0) throw new Error(`Missing release artifacts:\n- ${missing.join("\n- ")}`);

	await run("git", ["tag", "--annotate", release.tag, "--message", release.tag]);
	await run("git", ["push", "origin", release.tag]);

	const releaseFlags = release.prerelease ? ["--prerelease", "--latest=false"] : [];
	await run("gh", ["release", "create", release.tag, "--draft", "--verify-tag", "--title", release.tag, "--generate-notes", ...releaseFlags, ...assets]);

	console.log(`\nDraft release created: ${output("gh", ["release", "view", release.tag, "--json", "url", "--jq", ".url"])}`);
	console.log("Review the notes, then publish it on GitHub: the applications only see published releases.");
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(`\n${(error as Error).message}`);
		process.exitCode = 1;
	}
}
