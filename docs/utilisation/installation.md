# Installation

[← Documentation](../README.md)

Les installeurs sont publiés dans les [releases GitHub](https://github.com/Elyspio/ely-vault-ui/releases). Ils se génèrent aussi depuis les sources (voir [Démarrage](../developpement/demarrage.md)) :

| Plateforme | Format           | Commande             |
| ---------- | ---------------- | -------------------- |
| Windows    | Installeur NSIS  | `pnpm package:win`   |
| Linux      | AppImage, `.deb` | `pnpm package:linux` |

Au premier lancement, saisir l'adresse du serveur (`https://…`), l'adresse e-mail et le mot de passe maître. La connexion en deux étapes (application d'authentification, e-mail, YubiKey) est prise en charge.
