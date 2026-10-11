# Installation

[← Documentation](../README.md)

The installers are published in the [GitHub releases](https://github.com/Elyspio/ely-vault-ui/releases). They can also be built from the sources (see [Getting started](../development/getting-started.md)):

| Platform | Format           | Command              |
| -------- | ---------------- | -------------------- |
| Windows  | NSIS installer   | `pnpm package:win`   |
| Linux    | AppImage, `.deb` | `pnpm package:linux` |

On first launch, enter the server address (`https://…`), the email address and the master password. Two-step login (authenticator app, email, YubiKey) is supported.

The theme is set in **Settings → Display → Theme**: Dark (default), Light, or System (follows the operating system). It applies immediately.

On Windows, after the first master password unlock of an account, ElyVault offers to use Windows Hello (accepting only asks for the Windows Hello verification; declining is remembered for the account). **Settings → Security → Unlock with Windows Hello** also the face, fingerprint or PIN unlock the vault: enter the master password once, then confirm with Windows Hello. The lock screen then opens Windows Hello directly; the master password still works. The choice is forgotten on logout, and Windows Hello is offered again when the master password changes.
