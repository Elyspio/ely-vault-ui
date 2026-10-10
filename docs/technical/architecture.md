# Architecture

[← Documentation](../README.md)

```text
Renderer (React, MUI)  ──IPC──▶  Main process  ──HTTP 127.0.0.1──▶  bw serve  ──HTTPS──▶  Vaultwarden server
   no secret                    secrets in memory                    (@bitwarden/cli)
```

- The Bitwarden CLI runs with the Electron binary in Node mode (`ELECTRON_RUN_AS_NODE`): no `bw` installation needed.
- Its data (encrypted vault, tokens) is isolated in `%LOCALAPPDATA%/vault-desktop/bitwarden`, separate from a global installation.
- Login: `bw login` (password passed through an environment variable, never as an argument), then `bw serve` on `127.0.0.1` with a random port, unlocked through `POST /unlock`.

| Layer     | Technologies                                               |
| --------- | ---------------------------------------------------------- |
| Interface | React 19, MUI 9, Redux Toolkit                             |
| Desktop   | Electron 44, electron-vite, electron-builder               |
| Main      | Inversify (dependency injection), winston, koffi (FFI)     |
| Tooling   | TypeScript 7, vite-plus (format, lint, tests), pnpm        |

```text
app/                # Application project (pnpm, electron-vite, electron-builder)
├── src/
│   ├── main/       # Main process: Bitwarden CLI, vault, security, auto-type, IPC
│   ├── preload/    # Typed IPC bridge exposed to the renderer
│   ├── renderer/   # React interface
│   └── shared/     # Shared types, configuration and IPC contracts
├── config/         # electron-vite, electron-builder
├── resources/      # Embedded icon
├── build/          # Packaging resources (icons)
└── scripts/        # Local test server, releasing
deploy/             # Linux build container
docs/               # Documentation
```
