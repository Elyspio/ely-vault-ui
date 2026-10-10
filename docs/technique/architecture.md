# Architecture

[← Documentation](../README.md)

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
app/                # Projet de l'application (pnpm, electron-vite, electron-builder)
├── src/
│   ├── main/       # Process principal : CLI Bitwarden, coffre, sécurité, saisie automatique, IPC
│   ├── preload/    # Pont IPC typé exposé au renderer
│   ├── renderer/   # Interface React
│   └── shared/     # Types, configuration et contrats IPC partagés
├── config/         # electron-vite, electron-builder
├── resources/      # Icône embarquée
├── build/          # Ressources de packaging (icônes)
└── scripts/        # Serveur de test local, publication
deploy/             # Conteneur de build Linux
docs/               # Documentation
```
