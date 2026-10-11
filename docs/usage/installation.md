# Installation

[← Documentation](../README.md)

The installers are published in the [GitHub releases](https://github.com/Elyspio/ely-vault-ui/releases). They can also be built from the sources (see [Getting started](../development/getting-started.md)):

| Platform | Format           | Command              |
| -------- | ---------------- | -------------------- |
| Windows  | NSIS installer   | `pnpm package:win`   |
| Linux    | AppImage, `.deb` | `pnpm package:linux` |

On first launch, enter the server address (`https://…`), the email address and the master password. Two-step login (authenticator app, email, YubiKey) is supported.

The theme is set in **Settings → Display → Theme**: Dark (default), Light, or System (follows the operating system). It applies immediately.
