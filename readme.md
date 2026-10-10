<div align="center">

<img src="resources/icon.png" alt="Vault" width="96" height="96" />

# Ely Vault UI

**Client de bureau rapide et sobre pour Vaultwarden / Bitwarden, pensé pour le clavier.**

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
![Plateformes](https://img.shields.io/badge/plateformes-Windows%20%7C%20Linux-informational)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)

</div>

---

Ely Vault UI est une interface de bureau au-dessus du **CLI Bitwarden officiel** (`@bitwarden/cli`). Elle se connecte à n'importe quel serveur **Vaultwarden** ou **Bitwarden** et permet de retrouver, consulter et utiliser ses secrets sans quitter le clavier.

Toute la cryptographie est déléguée au CLI officiel : l'application n'implémente aucun algorithme de chiffrement.

> **Statut** : version 1, en lecture seule. La création et la modification d'éléments se font depuis le coffre web.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Saisie automatique](#saisie-automatique)
- [Raccourcis clavier](#raccourcis-clavier)
- [Architecture](#architecture)
- [Modèle de sécurité](#modèle-de-sécurité)
- [Développement](#développement)
- [Licence](#licence)

## Fonctionnalités

- **Recherche instantanée** dans tout le coffre, filtres par type, dossier, organisation et collection.
- **Palette de commandes** (`Ctrl K`) : chercher et copier un mot de passe, un identifiant ou un code TOTP en deux touches.
- **Saisie automatique** façon KeePass : `Ctrl V` tape l'identifiant puis le mot de passe dans l'application ouverte juste avant.
- **Tous les types d'éléments** : identifiants, codes TOTP, cartes, identités, notes sécurisées, clés SSH, champs personnalisés.
- **Presse-papiers maîtrisé** : effacement automatique, exclusion de l'historique Windows (`Win V`) et du presse-papiers cloud.
- **Verrouillage automatique** : inactivité, verrouillage de session, mise en veille, fermeture.
- **Re-saisie du mot de passe maître** pour les éléments protégés (« reprompt »).
- **Générateur de mot de passe**.
- **PKI d'entreprise et certificats auto-signés** : revue et approbation explicite de l'autorité racine, sans jamais désactiver la vérification TLS.

## Installation

Les installeurs se génèrent depuis les sources (voir [Développement](#développement)) :

| Plateforme | Format           | Commande             |
| ---------- | ---------------- | -------------------- |
| Windows    | Installeur NSIS  | `pnpm package:win`   |
| Linux      | AppImage, `.deb` | `pnpm package:linux` |

Au premier lancement, saisir l'adresse du serveur (`https://…`), l'adresse e-mail et le mot de passe maître. La connexion en deux étapes (application d'authentification, e-mail, YubiKey) est prise en charge.

## Saisie automatique

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

## Raccourcis clavier

| Raccourci                | Action                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl K`                 | Palette : rechercher dans tout le coffre et copier (`↵` mot de passe, `Maj ↵` identifiant, `Ctrl ↵` TOTP, `Alt ↵` afficher) |
| `Ctrl F`                 | Filtrer la liste                                                                                                            |
| `↑` `↓` / `Entrée`       | Parcourir / copier la valeur principale                                                                                     |
| `Ctrl V`                 | Saisie automatique de l'élément sélectionné dans la fenêtre précédente                                                      |
| `Ctrl Maj C` / `U` / `O` | Copier mot de passe / identifiant / code TOTP de l'élément sélectionné                                                      |
| `Ctrl G`                 | Générateur de mot de passe                                                                                                  |
| `F5`                     | Synchroniser                                                                                                                |
| `Ctrl L`                 | Verrouiller                                                                                                                 |
| `Ctrl ,`                 | Paramètres                                                                                                                  |

## Architecture

```text
Renderer (React, MUI)  ──IPC──▶  Main process  ──HTTP 127.0.0.1──▶  bw serve  ──HTTPS──▶  serveur Vaultwarden
   sans aucun secret            secrets en mémoire                   (@bitwarden/cli)
```

- Le CLI Bitwarden est lancé avec le binaire Electron en mode Node (`ELECTRON_RUN_AS_NODE`) : aucune installation de `bw` requise.
- Ses données (coffre chiffré, jetons) sont isolées dans `%LOCALAPPDATA%/vault-desktop/bitwarden`, séparées d'une éventuelle installation globale.
- Connexion : `bw login` (mot de passe transmis par variable d'environnement, jamais en argument), puis `bw serve` sur `127.0.0.1` avec un port aléatoire, déverrouillé via `POST /unlock`.

| Couche    | Technologies                                               |
| --------- | ---------------------------------------------------------- |
| Interface | React 19, MUI 9, Redux Toolkit                             |
| Bureau    | Electron 44, electron-vite, electron-builder               |
| Main      | Inversify (injection de dépendances), winston, koffi (FFI) |
| Outillage | TypeScript 7, vite-plus (format, lint, tests), pnpm        |

```text
src/
├── main/       # Process principal : CLI Bitwarden, coffre, sécurité, saisie automatique, IPC
├── preload/    # Pont IPC typé exposé au renderer
├── renderer/   # Interface React
└── shared/     # Types, configuration et contrats IPC partagés
```

## Modèle de sécurité

- **Le renderer ne reçoit jamais de secret en masse** : les éléments sont nettoyés par le process principal (`vault.mapper.ts`). Chaque secret est demandé à la demande (afficher, copier, saisir), par identifiant.
- **Copie par le process principal** : le presse-papiers est effacé après le délai configuré s'il contient encore la valeur. Sous Windows, les valeurs copiées sont exclues de l'historique et du presse-papiers cloud.
- **Re-saisie du mot de passe maître** pour les éléments « reprompt », vérifiée hors ligne (hash scrypt en mémoire), valable 5 minutes.
- **Verrouillage** : manuel (`Ctrl L`), après inactivité, au verrouillage de session, à la mise en veille et à la fermeture (`bw serve` est arrêté).
- **Durcissement Electron** : `sandbox`, `contextIsolation`, pas de `nodeIntegration`, CSP stricte, navigation et nouvelles fenêtres bloquées, permissions web refusées, IPC accepté uniquement depuis la page de l'application, seuls les liens `http(s)` sont ouverts, fuses Electron restreints.
- **Certificats** : aucune option « ignorer les erreurs TLS ». Quand le système refuse le certificat du serveur, l'application complète la chaîne via les URL AIA (chaque certificat téléchargé doit avoir signé le précédent), affiche l'autorité racine et son empreinte SHA-256, et ne l'approuve qu'après confirmation. Un certificat d'autorité peut aussi être importé (`.crt`, `.cer`, `.pem`). Les autorités approuvées sont transmises au CLI (`NODE_EXTRA_CA_CERTS`) et à Chromium, et se retirent dans **Paramètres → Certificats approuvés**.
- **Aucun secret dans les journaux** : le décorateur de log n'enregistre ni paramètres ni valeurs de retour.

> **Limite connue** : `bw serve` n'a pas d'authentification. Tant que le coffre est déverrouillé, un processus local qui trouve le port peut le lire (les requêtes de navigateur sont refusées par le CLI grâce au contrôle de l'en-tête `Origin`). C'est le même modèle que `bw serve` utilisé seul.

## Développement

**Prérequis** : Node 26+, pnpm 12.5.1.

```bash
pnpm install
pnpm dev
```

| Commande             | Rôle                                  |
| -------------------- | ------------------------------------- |
| `pnpm dev`           | Electron en mode développement        |
| `pnpm build`         | Build electron-vite (`out/`)          |
| `pnpm check`         | Format, lint et types (vite-plus)     |
| `pnpm typecheck`     | Vérification TypeScript               |
| `pnpm test`          | Tests unitaires                       |
| `pnpm package:win`   | Installeur Windows (electron-builder) |
| `pnpm package:linux` | AppImage et `.deb`                    |

### Serveur de test local

Le CLI Bitwarden exige HTTPS. Pour un Vaultwarden jetable en local :

1. Générer une autorité de certification et un certificat `localhost` dans `scripts/dev/ssl` (ignoré par git) : `ca.pem`, `cert.pem`, `key.pem`.
2. Lancer le serveur :

    ```bash
    docker run -d --name vw-test -e SIGNUPS_ALLOWED=true -e I_REALLY_WANT_VOLATILE_STORAGE=true -e DOMAIN=https://localhost:8099 -e ROCKET_TLS='{certs="/ssl/cert.pem",key="/ssl/key.pem"}' -v "$PWD/scripts/dev/ssl:/ssl:ro" -p 127.0.0.1:8099:80 vaultwarden/server:latest
    ```

3. Créer le compte de test (`scripts/dev/dev-vault.env`, valeurs de test uniquement) et le remplir avec des éléments d'exemple :

    ```bash
    NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev:vault:register
    NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev:vault:seed
    ```

4. Lancer l'application avec `NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev` (la variable est transmise au CLI).

## Licence

Distribué sous licence [MIT](LICENSE).

Projet indépendant, non affilié à Bitwarden Inc. ni au projet Vaultwarden. « Bitwarden » est une marque de Bitwarden Inc.
