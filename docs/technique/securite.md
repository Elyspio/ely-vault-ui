# Modèle de sécurité

[← Documentation](../README.md)

- **Le renderer ne reçoit jamais de secret en masse** : les éléments sont nettoyés par le process principal (`vault.mapper.ts`). Chaque secret est demandé à la demande (afficher, copier, saisir), par identifiant.
- **Copie par le process principal** : le presse-papiers est effacé après le délai configuré s'il contient encore la valeur. Sous Windows, les valeurs copiées sont exclues de l'historique et du presse-papiers cloud.
- **Re-saisie du mot de passe maître** pour les éléments « reprompt », vérifiée hors ligne (hash scrypt en mémoire), valable 5 minutes.
- **Verrouillage** : manuel (`Ctrl L`), après inactivité, au verrouillage de session, à la mise en veille et à la fermeture (`bw serve` est arrêté).
- **Durcissement Electron** : `sandbox`, `contextIsolation`, pas de `nodeIntegration`, CSP stricte, navigation et nouvelles fenêtres bloquées, permissions web refusées, IPC accepté uniquement depuis la page de l'application, seuls les liens `http(s)` sont ouverts, fuses Electron restreints.
- **Certificats** : aucune option « ignorer les erreurs TLS ». Quand le système refuse le certificat du serveur, l'application complète la chaîne via les URL AIA (chaque certificat téléchargé doit avoir signé le précédent), affiche l'autorité racine et son empreinte SHA-256, et ne l'approuve qu'après confirmation. Un certificat d'autorité peut aussi être importé (`.crt`, `.cer`, `.pem`). Les autorités approuvées sont transmises au CLI (`NODE_EXTRA_CA_CERTS`) et à Chromium, et se retirent dans **Paramètres → Certificats approuvés**.
- **Aucun secret dans les journaux** : le décorateur de log n'enregistre ni paramètres ni valeurs de retour.

> **Limite connue** : `bw serve` n'a pas d'authentification. Tant que le coffre est déverrouillé, un processus local qui trouve le port peut le lire (les requêtes de navigateur sont refusées par le CLI grâce au contrôle de l'en-tête `Origin`). C'est le même modèle que `bw serve` utilisé seul.
