# Getting started

[← Documentation](../README.md)

**Prerequisites**: Node 26+, pnpm 12.5.1. Commands run from `app/`.

```bash
cd app
pnpm install
pnpm dev
```

| Command              | Role                                            |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | Electron in development mode                    |
| `pnpm build`         | electron-vite build (`out/`)                    |
| `pnpm check`         | Format, lint and types (vite-plus)              |
| `pnpm typecheck`     | TypeScript check                                |
| `pnpm test`          | Unit tests                                      |
| `pnpm package:win`   | Windows installer (electron-builder)            |
| `pnpm package:linux` | AppImage and `.deb` (Docker container on Windows) |
| `pnpm release`       | Draft GitHub release                            |

In development, **Check** (Settings → Updates) queries the releases through `dev-app-update.yml`; nothing is installed.

See also: [Releasing](releasing.md), [Local test server](local-test-server.md).
