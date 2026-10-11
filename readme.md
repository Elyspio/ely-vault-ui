<div align="center">

<img src="app/resources/icon.png" alt="ElyVault" width="96" height="96" />

# ElyVault

**Fast, clean, keyboard-first desktop client for Vaultwarden / Bitwarden.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-informational)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)

</div>

---

ElyVault is a desktop interface on top of the **official Bitwarden CLI** (`@bitwarden/cli`). It connects to any **Vaultwarden** or **Bitwarden** server and lets you find, view and use your secrets without leaving the keyboard.

All vault cryptography is delegated to the official CLI: the application implements no encryption algorithm (SSH keys are generated and converted with the `sshpk` library, like the official clients do with their SDK).

> **Status**: items can be created, edited, moved to the trash and restored, marked as favorites, put in folders, and SSH keys can be generated or imported. Attachments, organization moves and collections stay in the web vault.

## Features

- **Instant search** across the whole vault, filters by type, folder, organization and collection.
- **Command palette** (`Ctrl K`): find and copy a password, a username or a TOTP code in two keystrokes.
- **KeePass-style auto-type**: `Ctrl V` types the username then the password into the application opened just before.
- **Every item type**: logins, TOTP codes, cards, identities, secure notes, SSH keys, custom fields.
- **Keyboard-driven editing**: create (`Ctrl N`), edit (`Ctrl E`), save (`Ctrl S`), move to the trash (`Del`, with undo), favorite (`Ctrl D`), move to a folder (`Ctrl M`).
- **Trash**: restore items, delete them permanently or empty the trash.
- **Folders**: nested folders (`Work/Projects`), renamed or deleted from the sidebar.
- **TOTP from a QR code**: copy a screenshot of the QR code, then read it in the editor.
- **SSH keys**: generate an Ed25519 key or import an existing one; the private key never reaches the interface.
- **Controlled clipboard**: automatic clearing, excluded from the Windows history (`Win V`) and the cloud clipboard.
- **Auto-lock**: inactivity, session lock, sleep, quit.
- **Master password re-entry** for protected items ("reprompt").
- **Password generator**.
- **Corporate PKI and self-signed certificates**: explicit review and approval of the root authority, without ever disabling TLS verification.

## Installation

Windows (NSIS) and Linux (AppImage, `.deb`) installers are published in the [GitHub releases](https://github.com/Elyspio/ely-vault-ui/releases); the application then updates itself. Details: [Installation](docs/usage/installation.md), [Updates](docs/usage/updates.md).

## Documentation

| Usage                                                  | Technical                                      | Development                                                |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- |
| [Installation](docs/usage/installation.md)             | [Architecture](docs/technical/architecture.md) | [Getting started](docs/development/getting-started.md)     |
| [Updates](docs/usage/updates.md)                       | [Security model](docs/technical/security.md)   | [Releasing](docs/development/releasing.md)                 |
| [Auto-type](docs/usage/auto-type.md)                   |                                                | [Local test server](docs/development/local-test-server.md) |
| [Editing items](docs/usage/editing.md)                 |                                                |                                                            |
| [Keyboard shortcuts](docs/usage/keyboard-shortcuts.md) |                                                |                                                            |

## License

Distributed under the [MIT](LICENSE) license.

Independent project, not affiliated with Bitwarden Inc. nor the Vaultwarden project. "Bitwarden" is a trademark of Bitwarden Inc.
