# Releasing

[← Documentation](../README.md)

1. Before squashing a PR, build and publish a development prerelease from a dedicated `git worktree` of its clean, pushed branch with `pnpm release:dev` (see below). Comment on the open PR with the release URL and validation results.
2. The user saying "good" (or otherwise approving) on that dev/prerelease version is final approval to merge and publish the stable release directly. Keep the PR open before approval. Functional changes after validation require a new development build and approval.
3. After approval, squash/merge the approved PR. Open and merge a `chore: release vX.Y.Z` PR that changes `version` in `app/package.json` (`X.Y.Z-beta.N` for a beta). Version-only release metadata does not require another approval or approval prerelease. Remove each merged PR's worktree and rebase the main worktree onto the latest `origin/main`.
4. On an up to date `main`, on Windows, with Docker (or Podman) running and `gh` authenticated, run `pnpm release` from `app/`. It:
    - checks the repository (branch, uncommitted changes, existing tag, version greater than the latest tag), then runs `vp check`, the type check and the tests;
    - builds the Windows installer locally and the Linux packages in a container (`deploy/release/linux.Dockerfile`, at the repository root), in parallel (output lines prefixed `[windows]` / `[linux]`; `pnpm package` runs the same builds without publishing);
    - pushes the `vX.Y.Z` tag and publishes the release directly (prerelease for a beta) with notes generated from the merged PRs. Never create a draft release.
5. Add the published release URL to each merged PR included in it.

GitHub's Atom feed can list a tag while its release is still a draft. The updater tries eligible versions from highest to lowest and skips a version when its platform's `latest*.yml` returns HTTP 404. If none has available metadata, it reports no published release; authentication, rate-limit, server, network and malformed-metadata errors still surface. A skipped tag is retried on the next check, so publishing it makes it eligible without restarting the app.

## Development builds

`pnpm release:dev` (from `app/`, same tools) publishes a development build from any branch, `main` included:

- requires a clean working tree and HEAD pushed to its remote branch, then runs `vp check`, the type check and the tests;
- version `X.Y.Z-dev.N`: X.Y.Z is the version of `app/package.json` (without prerelease) until it is released, then the patch after the latest release, and never lower than the latest development build (a branch behind another one continues its numbering, so versions follow the publication order and are never reused); N follows the development builds of X.Y.Z already tagged. `package.json` is not changed: the version is injected at build time (`extraMetadata.version`, `RELEASE_VERSION` in the Linux container);
- pushes the `vX.Y.Z-dev.N` tag and publishes a **prerelease** right away (not marked latest), with the branch, the commit and the commits since the previous development build as notes;
- keeps the 5 newest development builds: the older releases and their tags are deleted.

Only the applications on the **Dev** update channel install them (see [Updates](../usage/updates.md)); they also install a stable or beta release of a higher version. Stable and beta releases ignore the development tags (`1.2.0-beta.1` sorts before `1.2.0-dev.3`), and their notes start from the previous stable or beta release.
