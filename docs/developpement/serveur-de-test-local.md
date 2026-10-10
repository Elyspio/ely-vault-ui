# Serveur de test local

[← Documentation](../README.md)

Commandes lancées depuis `app/`.

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
