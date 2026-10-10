# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, Copilot…) when working with code in this repository.

## Project Overview

**Ely Vault UI** (`vault-desktop`) — keyboard-first desktop client for Vaultwarden / Bitwarden servers (Windows + Linux). It is a UI on top of the official Bitwarden CLI (`@bitwarden/cli`): all cryptography is delegated to the CLI, the app implements none. Version 1 is read-only (no item creation/edit). UI strings, the readme and `docs/` are in English.

## Repository Layout

- `app/` — the application project: `package.json`, pnpm files, `src/`, `config/`, `resources/`, `build/`, `scripts/`, tsconfigs, `vite.config.ts`. **Run every command from `app/`**; paths in this file are relative to `app/` unless stated otherwise.
- Repository root — `AGENTS.md`, `CLAUDE.md`, `readme.md` (overview + documentation index), `docs/` (`usage/`, `technical/`, `development/`), `LICENSE`, `.gitignore`, `.dockerignore` and `deploy/` (`deploy/release/linux.Dockerfile`, built with the repository root as context).

## Commands

| Task                                 | Command                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Install deps                         | `pnpm install`                                                                                       |
| Dev mode                             | `pnpm dev` (electron-vite, watch)                                                                    |
| Build                                | `pnpm build` (electron-vite build, output in `out/`)                                                 |
| Preview built app                    | `pnpm start`                                                                                         |
| Check (fmt + lint + types, auto-fix) | `pnpm check` (`vp check --fix`)                                                                      |
| Typecheck                            | `pnpm typecheck` (`tsc -b --noEmit`)                                                                 |
| Test                                 | `pnpm test` (`vp test`, `src/**/*.test.ts` and `scripts/**/*.test.ts`, node environment)             |
| Package Windows (NSIS)               | `pnpm package:win`                                                                                   |
| Package Linux (AppImage, .deb)       | `pnpm package:linux` (native on Linux, in the root `deploy/release/linux.Dockerfile` container elsewhere) |
| Development build (any branch)       | `pnpm release:dev` (`X.Y.Z-dev.N` prerelease, see `docs/development/releasing.md`)                       |
| Draft GitHub release (Windows host)  | `pnpm release` (`scripts/release/release.ts`, see `docs/development/releasing.md`)                                            |
| Local test vault                     | `pnpm dev:vault:register` / `pnpm dev:vault:seed` (see `docs/development/local-test-server.md`)                                       |

Package manager: **pnpm 12.5.1**, Node **26+**. Build/dev use electron-vite (`config/electron.vite.config.ts`, also injects the renderer CSP), builder config at `config/electron-builder.yml`. The vite-plus toolchain (fmt/lint/test) is configured in `vite.config.ts`; `vite` is aliased to `@voidzero-dev/vite-plus-core` via the pnpm catalog (`pnpm-workspace.yaml`).

## Architecture

```text
Renderer (React, MUI)  ──IPC──▶  Main process  ──HTTP 127.0.0.1──▶  bw serve  ──HTTPS──▶  Vaultwarden
   no secrets                    secrets in memory                   (@bitwarden/cli)
```

### Three-Process Electron Model

- **Main process** (`src/main/`): Node.js, modules extending `LogModule` for Winston logging, Inversify DI with `autobind: true` and singleton scope (`src/main/di/container.di.ts`).
- **Preload** (`src/preload/`): Exposes typed `window.preload` bridge via contextBridge (`parts/` holds the IPC sender/receiver wrappers).
- **Renderer** (`src/renderer/src/`): React 19, MUI 9, Redux Toolkit (`store/module/*`), Inversify services (`core/services/`, container in `core/di/web.container.ts`).
- **Shared** (`src/shared/`): IPC channel contracts, config defaults, types, autotype sequence parser.

### Main Modules (`src/main/modules/`)

- `bitwarden/` — `BwCliModule` runs the CLI with the Electron binary in Node mode (`ELECTRON_RUN_AS_NODE`); `BwServeModule` manages `bw serve` on 127.0.0.1 with a random port. CLI data isolated in `<appFolder>/bitwarden`.
- `vault/` — `VaultModule` (login, unlock, lock, snapshot, secrets on demand), `vault.mapper.ts` (strips secrets before sending items to the renderer), `password.generator.ts`.
- `update/` — `UpdateModule`: auto update from the GitHub releases (`electron-updater`): checks at startup then hourly (setting `updates.autoCheck`), downloads newer releases, installs on restart or quit; update channel `updates.channel` (`stable` / `beta` / `dev`, mapped to the electron-updater channel; `beta` skips the `-dev` releases) and user-confirmed downgrade when the channel's newest version is older. Locks the vault and stops `bw serve` before `quitAndInstall`. Dev builds check through `dev-app-update.yml` and never install.
- `security/` — auto-lock, clipboard (auto-clear, excluded from Windows history/cloud clipboard), certificate review/approval of private CAs.
- `autotype/` — KeePass-style auto-type: Windows `SendInput` via koffi FFI, Linux X11 via `xdotool`.
- `config/`, `context/`, `window/`, `ipc.module.ts`, `log.module.ts`.

### IPC Contract

Typed channels in `src/shared/ipc/ipc.handled.events.ts` (renderer→main) and `ipc.sent.events.ts` (main→renderer). Handlers registered centrally in `src/main/ipc/ipc.handler.ts` (they resolve modules from `mainContainer`). When adding IPC channels, define types in shared, register the handler in `ipc.handler.ts`, and expose via preload.

### Module Pattern

Main-process logic lives in modules extending `LogModule`. Use constructor DI (Inversify `@injectable()` + `@inject()`) over singletons. The `@log` / `@log.debug` decorators (`src/main/utils/logs.utils.ts`) emit enter/exit timing.

### Config

App folder: `%LOCALAPPDATA%/vault-desktop` (Linux: Electron `appData`), see `MainContextModule`. Defaults in `src/shared/config/app.config.ts`, names/appId in `main.config.ts`. `VAULT_DEBUG=1` or `--debug` / `--devtools` enables debug in packaged builds.

### TypeScript Path Aliases

- Node (`tsconfig.node.json`): `@main/*`, `@preload/*`, `@shared/*`.
- Renderer (`tsconfig.web.json`): `@/*` → renderer src, `@components/*`, `@core/*`, `@hooks/*`, `@modules/*` (store modules), `@services/*`, `@store`, `@store/*`, `@view/*`, `@preload/*`, `@shared/*`.

## Security Rules

- The renderer never receives secrets in bulk: items go through `vault.mapper.ts`; secrets are requested on demand by item id (show/copy/type) and copy/auto-type happen in the main process.
- Never log secrets: no parameters or return values of secret-handling functions in logs.
- Passwords go to the CLI through environment variables, never as command-line arguments.
- Never add an "ignore TLS errors" option; private CAs go through explicit review/approval (`certificate.module.ts`), passed to the CLI and Chromium.
- Updates come only from the GitHub releases through `electron-updater` (HTTPS + SHA-512 of `latest*.yml`): never add another update source or skip its verification.
- Keep Electron hardening intact: `sandbox`, `contextIsolation`, no `nodeIntegration`, strict CSP, blocked navigation/new windows, IPC only from the app page, only `http(s)` links opened externally.

## Key Conventions

- Extend DI modules instead of creating ad-hoc singletons
- Keep renderer/main shared types under `src/shared`
- TypeScript decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`)
- Lint/format config: `defaultLintConfig` / `defaultFmtConfig` from `@elyspio/vite-eslint-config` (Oxlint + Oxfmt through vite-plus)
- Unit tests sit next to the code as `*.test.ts` (pure logic: mapper, generator, search, folders, autotype)

## Development Workflow

- Make sure to run `pnpm check` and `pnpm test` before committing.
- The CLI requires HTTPS: for a local Vaultwarden test server, follow `docs/development/local-test-server.md` and run with `NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem`.
- Commits follow Conventional Commits (`feat:`, `fix:`, …); PRs are squash-merged.

## Git & Release Conventions

- Releases: bump `version` in `package.json` through a `chore: release vX.Y.Z` PR, then run `pnpm release` on an up to date `main` (Windows, Docker/Podman, authenticated `gh`). It builds Windows locally and Linux in `deploy/release/linux.Dockerfile`, pushes the tag and creates a **draft** GitHub release with generated notes; publish it by hand. Only `x.y.z` and `x.y.z-beta.n` versions are allowed. Development builds: `pnpm release:dev` from any clean, pushed branch publishes `X.Y.Z-dev.N` as a prerelease (version injected at build time, 5 newest kept).

- No `Co-Authored-By` trailer (nor any AI attribution line such as "Generated with Claude Code") in commit messages, PR descriptions or squash merge messages.
- Release notes come from the squash merge commit of the PR: keep them free of these attribution lines too (pass an explicit `--body` to `gh pr merge --squash` when the branch commits carry trailers).
