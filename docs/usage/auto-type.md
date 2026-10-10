# Auto-type

[← Documentation](../README.md)

Select a login and press `Ctrl V` (or click **Auto-type**, or `Ctrl Shift V` in the palette): the window minimizes and the sequence is typed into the application that gets the focus back.

| Setting (Settings → Auto-type) | Default                     |
| ------------------------------ | --------------------------- |
| Default sequence               | `{USERNAME}{TAB}{PASSWORD}` |
| Press Enter                    | On (adds `{ENTER}`)         |
| After typing                   | Stay minimized              |

**Available codes**: `{USERNAME}` `{PASSWORD}` `{TOTP}` `{TAB}` `{ENTER}` `{DELAY n}` (in ms). `{{}` and `{}}` type a brace; anything else is typed as is.

**Per-item sequence**: a custom field named `autotype` (text or hidden) replaces the default sequence. It is typed as is, without an added Enter.

**Safeguards**:

- the secrets never leave the main process;
- typing is cancelled when there is no target window (desktop, taskbar);
- it stops at once if the active window changes or the vault locks while typing;
- an invalid sequence is refused before the window minimizes.

**Platforms**:

| System        | Mechanism                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| Windows       | `SendInput` in Unicode: independent of the keyboard layout                            |
| Linux X11     | [`xdotool`](https://github.com/jordansissel/xdotool) (recommended dependency of the `.deb`) |
| Linux Wayland | Not available: the protocol blocks key injection                                      |
