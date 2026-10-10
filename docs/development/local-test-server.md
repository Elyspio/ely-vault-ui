# Local test server

[← Documentation](../README.md)

Commands run from `app/`.

The Bitwarden CLI requires HTTPS. For a disposable local Vaultwarden:

1. Generate a certificate authority and a `localhost` certificate in `scripts/dev/ssl` (ignored by git): `ca.pem`, `cert.pem`, `key.pem`.
2. Start the server:

    ```bash
    docker run -d --name vw-test -e SIGNUPS_ALLOWED=true -e I_REALLY_WANT_VOLATILE_STORAGE=true -e DOMAIN=https://localhost:8099 -e ROCKET_TLS='{certs="/ssl/cert.pem",key="/ssl/key.pem"}' -v "$PWD/scripts/dev/ssl:/ssl:ro" -p 127.0.0.1:8099:80 vaultwarden/server:latest
    ```

3. Create the test account (`scripts/dev/dev-vault.env`, test values only) and fill it with sample items:

    ```bash
    NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev:vault:register
    NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev:vault:seed
    ```

4. Start the application with `NODE_EXTRA_CA_CERTS=scripts/dev/ssl/ca.pem pnpm dev` (the variable is passed to the CLI).
