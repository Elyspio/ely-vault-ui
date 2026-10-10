# Releasing

[← Documentation](../README.md)

1. Open a `chore: release vX.Y.Z` PR that changes `version` in `app/package.json` (`X.Y.Z-beta.N` for a beta), then merge it.
2. On an up to date `main`, on Windows, with Docker (or Podman) running and `gh` authenticated, run `pnpm release` from `app/`. It:
    - checks the repository (branch, uncommitted changes, existing tag, version greater than the latest tag), then runs `vp check`, the type check and the tests;
    - builds the Windows installer locally and the Linux packages in a container (`deploy/release/linux.Dockerfile`, at the repository root), in parallel (output lines prefixed `[windows]` / `[linux]`; `pnpm package` runs the same builds without publishing);
    - pushes the `vX.Y.Z` tag and creates a **draft** release (prerelease for a beta) with notes generated from the merged PRs.
3. Review the notes, then publish the release on GitHub: the applications only see published releases.

## Development builds

`pnpm release:dev` (from `app/`, same tools) publishes a development build from any branch, `main` included:

- requires a clean working tree and HEAD pushed to its remote branch, then runs `vp check`, the type check and the tests;
- version `X.Y.Z-dev.N`: X.Y.Z is the version of `app/package.json` (without prerelease) until it is released, then the patch after the latest release, and never lower than the latest development build (a branch behind another one continues its numbering, so versions follow the publication order and are never reused); N follows the development builds of X.Y.Z already tagged. `package.json` is not changed: the version is injected at build time (`extraMetadata.version`, `RELEASE_VERSION` in the Linux container);
- pushes the `vX.Y.Z-dev.N` tag and publishes a **prerelease** right away (not marked latest), with the branch, the commit and the commits since the previous development build as notes;
- keeps the 5 newest development builds: the older releases and their tags are deleted.

Only the applications on the **Dev** update channel install them (see [Updates](../usage/updates.md)). Stable and beta releases ignore the development tags (`1.2.0-beta.1` sorts before `1.2.0-dev.3`), and their notes start from the previous stable or beta release.
