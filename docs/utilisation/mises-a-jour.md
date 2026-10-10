# Mises à jour

[← Documentation](../README.md)

L'application se met à jour depuis les releases GitHub (installeur Windows, AppImage et `.deb`) :

- elle cherche une nouvelle version au démarrage puis toutes les heures, et la télécharge dès qu'elle la trouve ;
- un point sur l'icône **Paramètres** signale une version prête : **Paramètres → Mises à jour → Redémarrer et installer**, sinon elle s'installe à la fermeture ;
- le coffre est verrouillé, `bw serve` arrêté et le presse-papiers effacé avant l'installation ;
- **Versions bêta** reçoit les préversions (`x.y.z-beta.n`). Les désactiver propose de revenir à la dernière version stable, installée seulement sur demande ;
- **Mises à jour automatiques** désactivé, rien n'est vérifié ni téléchargé sans cliquer sur **Vérifier**.

Pour publier une version : [Publier une version](../developpement/publier-une-version.md).

Les fichiers sont téléchargés en HTTPS depuis GitHub et vérifiés par leur empreinte SHA-512 (`latest.yml`). L'installeur Windows n'est pas signé : SmartScreen avertit à la première installation. Sous Linux, la mise à jour du `.deb` demande le mot de passe administrateur (`pkexec`).
