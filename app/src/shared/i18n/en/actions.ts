/** Feedback of the vault actions (toasts, reprompt dialog) and labels of the store */
export const actions = {
	reprompt: {
		title: "Protected item",
		description: "Enter your master password to access this secret.",
		passwordLabel: "Master password",
		incorrectPassword: "Incorrect password",
	},
	copy: {
		copied: "{{label}} copied",
		copiedCleared: "{{label}} copied · cleared in {{seconds}} s",
	},
	writes: {
		stoppedAfter_one: "Stopped after {{count}} change: {{message}}",
		stoppedAfter_other: "Stopped after {{count}} changes: {{message}}",
		savedNotReloaded: "Saved, but the vault could not be reloaded: {{error}}",
		movedToTrash: '"{{name}}" moved to the trash',
		undo: "Undo",
		itemRestored: "Item restored",
		purged_one: "Item permanently deleted",
		purged_other: "{{count}} items permanently deleted",
	},
	items: {
		saveOrCancelFirst: "Save or cancel the current edit first",
	},
	folders: {
		created: 'Folder "{{name}}" created',
		renamed: 'Folder renamed to "{{name}}"',
		deleted: 'Folder "{{name}}" deleted',
		noFolder: "No folder",
		groupsOnly: "This folder only groups its sub folders",
		deleteSubFoldersFirst: "Delete its sub folders first",
		moveItemsFirst: "Move or delete its items first",
		sameName: "Another folder has the same name",
	},
	session: {
		authorityImported: 'Authority "{{names}}" imported',
		clipboardCleared: "Clipboard cleared",
	},
	sync: {
		synced: "Vault synced",
		failed: "Sync failed: {{error}}",
	},
};
