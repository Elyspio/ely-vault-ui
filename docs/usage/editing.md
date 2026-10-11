# Editing items

[← Documentation](../README.md)

Items are created and edited in the editor, on the right of the vault. Changes are sent to the server only when you save (`Ctrl S`); `Esc` closes the editor and asks before discarding changes.

## Creating and editing

- **New item**: `Ctrl N`, then the type: `L` login, `N` secure note, `C` card, `I` identity, `S` SSH key. New items always go to your personal vault.
- A new item starts in the folder or favorites view you are in. A new login gets a generated password.
- **Edit**: `Ctrl E` or `F2` on the selected item.
- Values you do not touch are kept as they are on the server, including the fields this application does not show.

## Secrets

Passwords, card numbers, card codes, hidden fields, TOTP secrets and SSH private keys are write-only in the editor:

- An existing secret shows as **unchanged** (`••••••••`). Typing replaces it, the eye icon reveals the current value (the master password is asked when the item is protected), and the undo icon restores it.
- The clear icon removes the value on save ("Removed on save").
- `Ctrl G` in a password field (or the generate button) fills it with a generated password.

## Unsaved changes

When an item has unsaved changes and you select another item, change the filter, or press `Esc`, a question asks whether to **Save**, **Discard** or **Cancel** (`Esc` also cancels it). Nothing is lost silently.

## Conflicts

When you save an item that changed elsewhere since you opened the editor (another device, the web vault), nothing is written: the editor shows a warning, and you can either **discard my changes** and see the new version, or **save again**, which overwrites the other change with yours.

## Master password reprompt

Items protected by the master password re-entry ("reprompt", the switch in the editor header) ask for the password before they are edited, moved to the trash, deleted permanently, or before one of their secrets is revealed, copied, or typed by auto-type. Once the password is entered, the check stays valid for a few minutes.

## Trash

- `Del` moves the selected item to the trash. A notification offers **Undo** for six seconds.
- The trash is listed in the sidebar. From there an item can be **restored**, or **deleted permanently** after a confirmation. **Empty trash** deletes everything in it. Permanent deletion is final, on the server too.
- The server also purges items that stay in the trash for 30 days.

## Favorites and folders

- `Ctrl D` adds the selected item to the favorites, or removes it.
- `Ctrl M` moves the selected item to a folder: type to filter the folders, arrows and `Enter` pick one. New folders are created from the sidebar (**New folder**).
- A folder name is a path: `Work/Projects` is a folder inside `Work`. Empty segments and spaces around `/` are ignored.
- **Rename** a folder (sidebar): the folder and every folder under it are renamed. Renaming onto a name already used by another folder is refused, and so is moving a folder inside itself.
- **Delete** a folder: only when it holds no active item and no sub folder. Items in the trash do not block the deletion. Move the active items out of it first.

## SSH keys

- **Generate**: creates an Ed25519 key. The public key and fingerprint are shown; the private key is kept by the application until the item is saved, for at most 10 minutes.
- **Import**: a key file chosen from disk, or a key pasted in the editor (`Ctrl Enter` converts it). Keys are converted to the OpenSSH format, as the official Bitwarden clients do.
- A key protected by a passphrase is asked for its passphrase, then stored **without** encryption in the vault, as the official clients do. The vault itself stays encrypted.
- The private key never goes back to the interface: only the public key and the fingerprint are displayed.

## TOTP

- Enter a base32 secret (spaces and `=` are ignored), an `otpauth://totp/...` uri, or a `steam://` secret. `otpauth://hotp` is refused.
- **From a QR code**: take a screenshot of the QR code, then click **Read QR from clipboard** in the editor. The secret is read from the image and shown masked, like a typed value.
- The editor does not preview codes: the TOTP code appears in the vault after you save the item.

## Organization items

- Items of an organization you can edit are edited the same way. Items you can only view are refused by the server, with its message.
- Items cannot be moved into or out of an organization, and collections are not edited here: use the web vault.
- Attachments and archive are not managed here either.
