# Updates

[← Documentation](../README.md)

The application updates itself from the GitHub releases (Windows installer, AppImage and `.deb`):

- it checks for a new version at startup then every hour, and downloads it as soon as it finds one;
- a dot on the **Settings** icon shows a version ready to install: **Settings → Updates → Restart and install**, otherwise it is installed when the application quits;
- the vault is locked, `bw serve` stopped and the clipboard cleared before installing;
- **Beta versions** receives the prereleases (`x.y.z-beta.n`). Turning it off offers to go back to the latest stable version, only installed on request;
- with **Automatic updates** off, nothing is checked or downloaded without clicking **Check**.

To publish a version: [Releasing](../development/releasing.md).

The files are downloaded over HTTPS from GitHub and verified by their SHA-512 hash (`latest.yml`). The Windows installer is not signed: SmartScreen warns on the first install. On Linux, updating the `.deb` asks for the administrator password (`pkexec`).
