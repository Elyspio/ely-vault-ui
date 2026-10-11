# Security model

[← Documentation](../README.md)

- **The renderer never receives secrets in bulk**: the items are stripped by the main process (`vault.mapper.ts`). Each secret is requested on demand (show, copy, type), by id.
- **Copy by the main process**: the clipboard is cleared after the configured delay if it still holds the value. On Windows, copied values are excluded from the clipboard history and the cloud clipboard.
- **Master password re-entry** for "reprompt" items, checked offline (scrypt hash in memory), valid for 5 minutes.
- **Locking**: manual (`Ctrl L`), after inactivity, when the session locks, when the computer sleeps and on quit (`bw serve` is stopped).
- **Electron hardening**: `sandbox`, `contextIsolation`, no `nodeIntegration`, strict CSP, blocked navigation and new windows, web permissions denied, IPC only accepted from the application page, only `http(s)` links opened, restricted Electron fuses.
- **Certificates**: no "ignore TLS errors" option. When the system refuses the server certificate, the application completes the chain through the AIA URLs (each downloaded certificate must have signed the previous one), shows the root authority and its SHA-256 fingerprint, and only approves it after confirmation. An authority certificate can also be imported (`.crt`, `.cer`, `.pem`). The approved authorities are passed to the CLI (`NODE_EXTRA_CA_CERTS`) and to Chromium, and are removed in **Settings → Certificates**.
- **Write-only secrets**: in an edit, a secret is sent by the renderer only when the user typed or cleared it. Otherwise the main process keeps the stored value from the raw item. Secrets never enter the Redux store.
- **Full raw item on every edit**: the CLI replaces nested objects (login, card, fields) with what it receives, so the main process always starts from `GET /object/item/:id` and applies the changes on top. Passkeys, password history and other unknown properties are not lost.
- **Private SSH keys never reach the renderer**: generated or imported keys stay in the main process behind a random one-time token, expiring after 10 minutes, cleared on lock and logout. Only the public key and the fingerprint are shown. Passphrases and key material are never logged.
- **Reprompt enforced in the main process** for editing, moving to the trash, permanent deletion, and revealing, copying or auto-typing a secret of protected items.
- **Clipboard QR codes**: the screenshot is decoded in the main process; only a valid TOTP value goes back, and other QR codes are refused without echoing their content.
- **No secret in the logs**: the log decorator records neither parameters nor return values.

> **Known limitation**: `bw serve` has no authentication. While the vault is unlocked, a local process that finds the port can read it (browser requests are refused by the CLI through its `Origin` header check). This is the same model as `bw serve` used on its own.
