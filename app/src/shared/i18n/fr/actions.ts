import type { Translation } from "../i18n.types";
import type { actions as en } from "../en/actions";

export const actions: Translation<typeof en> = {
	reprompt: {
		title: "Élément protégé",
		description: "Saisissez votre mot de passe principal pour accéder à ce secret.",
		passwordLabel: "Mot de passe principal",
		incorrectPassword: "Mot de passe incorrect",
	},
	copy: {
		copied: "Copié : {{label}}",
		copiedCleared: "Copié : {{label}} · effacé dans {{seconds}} s",
	},
	writes: {
		stoppedAfter_one: "Arrêté après {{count}} modification : {{message}}",
		stoppedAfter_other: "Arrêté après {{count}} modifications : {{message}}",
		stoppedAfter_many: "Arrêté après {{count}} modifications : {{message}}",
		savedNotReloaded: "Enregistré, mais le coffre n'a pas pu être rechargé : {{error}}",
		movedToTrash: "« {{name}} » déplacé dans la corbeille",
		undo: "Annuler",
		itemRestored: "Élément restauré",
		purged_one: "Élément supprimé définitivement",
		purged_other: "{{count}} éléments supprimés définitivement",
		purged_many: "{{count}} éléments supprimés définitivement",
	},
	items: {
		saveOrCancelFirst: "Enregistrez ou annulez d'abord la modification en cours",
	},
	folders: {
		created: "Dossier « {{name}} » créé",
		renamed: "Dossier renommé en « {{name}} »",
		deleted: "Dossier « {{name}} » supprimé",
		noFolder: "Aucun dossier",
		groupsOnly: "Ce dossier ne fait que regrouper ses sous-dossiers",
		deleteSubFoldersFirst: "Supprimez d'abord ses sous-dossiers",
		moveItemsFirst: "Déplacez ou supprimez d'abord ses éléments",
		sameName: "Un autre dossier porte le même nom",
	},
	session: {
		authorityImported: "Autorité « {{names}} » importée",
		clipboardCleared: "Presse-papiers effacé",
	},
	sync: {
		synced: "Coffre synchronisé",
		failed: "Échec de la synchronisation : {{error}}",
	},
};
