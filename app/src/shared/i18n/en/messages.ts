/**
 * Messages produced by the main process, sent to the renderer as codes (see message.ts) and translated there.
 * Errors of the Bitwarden CLI and the network are passed through as is.
 */
export const messages = {
	// Session
	vaultLocked: "The vault is locked",
	vaultOfflineExpired: "Offline access expired: connect to the vault server to unlock",
	vaultAuthenticationRequired: "Authentication rejected: sign out and sign in again online",
	invalidServerAddress: "Invalid server address (https:// required)",
	serverUnreachable: "Server unreachable",
	serverUnreachableDetail: "Server unreachable: {{detail}}",
	ssoCancelled: "SSO login cancelled or expired",
	incorrectCredentials: "Incorrect email address or password",
	incorrectMasterPassword: "Incorrect master password",
	invalidVerificationCode: "Invalid verification code",
	certificateNotRecognized: "Server certificate not recognized: approve its authority in the settings",

	// Windows Hello
	unlockFirst: "Unlock the vault first",
	enableHelloFromSettings: "Enable Windows Hello from the settings",
	helloNotEnabled: "Windows Hello unlock is not enabled for this account",
	helloNoLongerValid: "Windows Hello unlock is no longer valid, unlock with the master password",
	helloPasswordChanged: "The master password changed, unlock with it to enable Windows Hello again",

	// Items and folders
	itemNotFound: "Item not found",
	itemNotInTrash: "Item not found in the trash",
	noItemSelected: "No item selected",
	nameRequired: "The name is required",
	itemTypeNotEditable: "This item type cannot be edited",
	itemTypeCannotChange: "The item type cannot change",
	restoreBeforeEditing: "Restore the item before editing it",
	unsupportedItemType: "Unsupported item type",
	sshKeyRequired: "An SSH key is required: generate, import or paste one",
	linkedFieldCannotBeCreated: "Linked fields cannot be created",
	customFieldMissing: "A custom field refers to a field that does not exist",
	customFieldDuplicated: "A custom field is listed more than once",
	linkedFieldKeepsType: "Linked fields keep their type",
	invalidTotpSecret: "Invalid TOTP secret",
	folderNotFound: "Folder not found",
	folderNameEmpty: "The folder name is empty",
	newFolderNameEmpty: "The new folder name is empty",
	folderNameUnchanged: "The new name is the same as the current one",
	folderExists: "A folder with this name already exists",
	noFolderUnder: 'No folder under "{{path}}"',
	folderHasItems: "Move or delete its items first",
	folderHasSubFolders: "Delete its sub folders first",

	// SSH keys
	sshKeyExpired: "The SSH key expired, generate or import it again",
	sshImportExpired: "The key expired, import it again",
	sshKeyTooLarge: "This is too large to be an SSH key",
	sshPassphraseRequired: "This key is protected by a passphrase",
	sshWrongPassphrase: "Wrong passphrase",
	sshDsaUnsupported: "DSA keys are not supported: use an Ed25519, RSA or ECDSA key",
	sshPublicKey: "This is a public key: choose or paste the private key",
	sshInvalidFormat: "Not a private key: OpenSSH, PEM or PKCS#8 format expected",
	sshUnsupportedType: "Unsupported key type: {{type}}",

	// TOTP QR code
	qrScreenshotRequired: "Copy a screenshot of the QR code first",
	qrImageTooLarge: "This image is too large to contain a QR code",
	qrInvalidImage: "The image is not valid",
	qrNotFound: "No QR code found in the image",
	qrNotTotp: "This QR code is not a TOTP secret",

	// Auto-type
	autoTypeInProgress: "Auto-type already in progress",
	autoTypeNeedsLogin: "Auto-type needs a login with a username or a password",
	autoTypeUnsafeCharacters: "Cannot type: the username or the password contains a tab or a line break",
	autoTypeNoTarget: "No target window: auto-type types into the window opened before {{app}}",
	autoTypeReleaseKeys: "Auto-type cancelled: release Ctrl, Shift, Alt and V",
	autoTypeLocked: "Auto-type stopped: the vault was locked",
	autoTypeWindowChanged: "Auto-type stopped: the active window changed",
	autoTypeUnavailable: "Auto-type is not available on this system",
	autoTypeModuleNotFound: "Auto-type unavailable: system module not found",
	autoTypeBlocked: "Typing blocked by the system",
	autoTypeWayland: "Not available on Wayland: it blocks typing keys into other applications",
	autoTypeInstallXdotool: "Install xdotool to use auto-type",

	// Auto-type sequences
	sequenceControlCharacter: "Control character at position {{position}}: use {TAB} or {ENTER}",
	sequenceUnclosedBrace: "Unclosed brace at position {{position}}",
	sequenceDelayTooLong: "Delay too long: {{code}} ({{max}} ms at most)",
	sequenceUnknownCode: "Unknown code: {{code}}",
	sequenceInvalidItem: 'Invalid "{{field}}" sequence of the item (position {{position}})',
	sequenceInvalidDefault: "Invalid default sequence: {{detail}}",

	// Certificates
	certificateUnknown: "Unknown certificate: log in again",
	certificateStillNotTrusted: "The server is still not trusted: {{detail}}",
	certificateNoneInFile: "No certificate in this file",
	certificateNotAuthority: '"{{name}}" is not an authority certificate',
	certificateWrongHost: "The certificate is not issued for {{host}}",
	certificateChainInvalid: "A certificate of the chain is expired or not yet valid",
	certificateRootNotFound: "Root authority not found: import its certificate",
	certificateSelfSigned: "Self-signed certificate",
	certificateAuthorityUnknown: 'Authority "{{name}}" unknown to this computer',
};
