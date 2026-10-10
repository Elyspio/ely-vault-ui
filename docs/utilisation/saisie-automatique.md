# Saisie automatique

[← Documentation](../README.md)

Sélectionner un identifiant et appuyer sur `Ctrl V` (ou cliquer sur **Saisie auto**, ou `Ctrl Maj V` dans la palette) : la fenêtre se réduit et la séquence est tapée dans l'application qui reprend le focus.

| Réglage (Paramètres → Saisie automatique) | Défaut                      |
| ----------------------------------------- | --------------------------- |
| Séquence par défaut                       | `{USERNAME}{TAB}{PASSWORD}` |
| Valider avec Entrée                       | Activé (ajoute `{ENTER}`)   |
| Après la saisie                           | Rester réduite              |

**Codes disponibles** : `{USERNAME}` `{PASSWORD}` `{TOTP}` `{TAB}` `{ENTER}` `{DELAY n}` (en ms). `{{}` et `{}}` tapent une accolade ; le reste est tapé tel quel.

**Séquence par élément** : un champ personnalisé nommé `autotype` (texte ou masqué) remplace la séquence par défaut. Il est tapé tel quel, sans Entrée ajoutée.

**Garde-fous** :

- les secrets ne quittent jamais le process principal ;
- la saisie est annulée s'il n'y a pas de fenêtre cible (bureau, barre des tâches) ;
- elle s'arrête net si la fenêtre active change ou si le coffre se verrouille en cours de frappe ;
- une séquence invalide est refusée avant que la fenêtre ne se réduise.

**Plateformes** :

| Système       | Mécanisme                                                                               |
| ------------- | --------------------------------------------------------------------------------------- |
| Windows       | `SendInput` en Unicode : indépendant de la disposition du clavier                       |
| Linux X11     | [`xdotool`](https://github.com/jordansissel/xdotool) (dépendance recommandée du `.deb`) |
| Linux Wayland | Non disponible : le protocole bloque l'injection de touches                             |
