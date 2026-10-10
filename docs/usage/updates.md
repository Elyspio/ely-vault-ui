# Updates

[← Documentation](../README.md)

The application updates itself from the GitHub releases (Windows installer, AppImage and `.deb`):

- it checks for a new version at startup then every hour, and downloads it as soon as it finds one;
- a dot on the **Settings** icon shows a version ready to install: **Settings → Updates → Restart and install**, otherwise it is installed when the application quits;
- the vault is locked, `bw serve` stopped and the clipboard cleared before installing;
- **Channel** selects the releases followed: **Stable**, **Beta** (also the prereleases `x.y.z-beta.n`) or **Dev** (the development builds `x.y.z-dev.n`, see [Releasing](../development/releasing.md#development-builds)). When the newest version of the channel is older than the installed one (after a channel change), Settings offers to go back to it: it is only downloaded and installed on request;
- with **Automatic updates** off, nothing is checked or downloaded without clicking **Check**.
- a beta or development build starts on its own channel (Beta, Dev) until another one is chosen; a channel without any release yet shows "No release on this channel yet".

To publish a version: [Releasing](../development/releasing.md).

The files are downloaded over HTTPS from GitHub and verified by their SHA-512 hash (`latest.yml`). The Windows installer is not signed: SmartScreen warns on the first install. On Linux, updating the `.deb` asks for the administrator password (`pkexec`).
