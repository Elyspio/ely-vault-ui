# Releasing

[← Documentation](../README.md)

1. Open a `chore: release vX.Y.Z` PR that changes `version` in `app/package.json` (`X.Y.Z-beta.N` for a beta), then merge it.
2. On an up to date `main`, on Windows, with Docker (or Podman) running and `gh` authenticated, run `pnpm release` from `app/`. It:
    - checks the repository (branch, uncommitted changes, existing tag, version greater than the latest tag), then runs `vp check`, the type check and the tests;
    - builds the Windows installer locally and the Linux packages in a container (`deploy/release/linux.Dockerfile`, at the repository root);
    - pushes the `vX.Y.Z` tag and creates a **draft** release (prerelease for a beta) with notes generated from the merged PRs.
3. Review the notes, then publish the release on GitHub: the applications only see published releases.
