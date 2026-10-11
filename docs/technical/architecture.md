# Architecture

[← Documentation](../README.md)

```text
Renderer (React, MUI)  ──IPC──▶  Main process  ──HTTP 127.0.0.1──▶  bw serve  ──HTTPS──▶  Vaultwarden server
   no secret                    secrets in memory                    (@bitwarden/cli)
```

- The Bitwarden CLI runs with the Electron binary in Node mode (`ELECTRON_RUN_AS_NODE`): no `bw` installation needed.
- Its data (encrypted vault, tokens) is isolated in `%LOCALAPPDATA%/elyvault/bitwarden`, separate from a global installation.
- Login: `bw login` (password passed through an environment variable, never as an argument), then `bw serve` on `127.0.0.1` with a random port, unlocked through `POST /unlock`.
- After each successful unlock (master password or Windows Hello), the vault syncs before loading its snapshot. If sync fails, the CLI cache remains available for offline use.

### Write flow

Items, folders and favorites are written through the CLI, never by the application itself:

1. The renderer sends a **draft**: the fields the user changed, with secrets only when the user typed or cleared them (`SecretChange`). The editor keeps the draft in component state, not in the store.
2. The main process checks the request (reprompt for protected items, the expected revision for an edit, the trash for restores and permanent deletes), then **merges the draft onto the raw item** (`vault.writer.ts`): it fetches `GET /object/item/:id` and applies only the requested changes. Unknown properties are kept.
3. The write goes to `bw serve` (`POST /object/item`, `PUT /object/item/:id`, `DELETE`, `POST /restore/item/:id`, folder routes). The CLI encrypts it and sends it to the server.
4. The snapshot is reloaded (`GET /list/object/items`, and `?trash=true`) until the change shows up, since `bw serve` answers before its cache is updated. The result is a `WriteResult`: the outcome of the write, and the new snapshot or the reload error.

Writes and syncs run one after the other in `VaultModule`. Each operation captures a session generation, and a result computed for a locked or replaced session is discarded.

Keys of SSH items are generated or converted in the main process (`ssh.key.module.ts`) and reach the item draft as a one-time token: the private key never goes to the renderer. TOTP values read from a QR code take the same path: the image is decoded in the main process (`totp.qr.module.ts`).

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
