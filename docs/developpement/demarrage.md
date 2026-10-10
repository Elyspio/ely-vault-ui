# Démarrage

[← Documentation](../README.md)

**Prérequis** : Node 26+, pnpm 12.5.1. Les commandes se lancent depuis `app/`.

```bash
cd app
pnpm install
pnpm dev
```

| Commande             | Rôle                                               |
| -------------------- | -------------------------------------------------- |
| `pnpm dev`           | Electron en mode développement                     |
| `pnpm build`         | Build electron-vite (`out/`)                       |
| `pnpm check`         | Format, lint et types (vite-plus)                  |
| `pnpm typecheck`     | Vérification TypeScript                            |
| `pnpm test`          | Tests unitaires                                    |
| `pnpm package:win`   | Installeur Windows (electron-builder)              |
| `pnpm package:linux` | AppImage et `.deb` (conteneur Docker sous Windows) |
| `pnpm release`       | Release GitHub en brouillon                        |

En développement, **Vérifier** interroge les releases via `dev-app-update.yml` ; rien n'est installé.

Voir aussi : [Publier une version](publier-une-version.md), [Serveur de test local](serveur-de-test-local.md).
