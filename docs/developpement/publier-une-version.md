# Publier une version

[← Documentation](../README.md)

1. Ouvrir une PR `chore: release vX.Y.Z` qui change `version` dans `package.json` (`X.Y.Z-beta.N` pour une bêta), puis la fusionner.
2. Sur `main` à jour, sous Windows, avec Docker (ou Podman) démarré et `gh` authentifié : `pnpm release`.
    - vérifie le dépôt (branche, modifications, tag existant, version supérieure au dernier tag), puis `vp check`, types et tests ;
    - construit l'installeur Windows en local et les paquets Linux dans un conteneur (`deploy/release/linux.Dockerfile`, à la racine du dépôt) ;
    - pousse le tag `vX.Y.Z` et crée une release **en brouillon** (préversion pour une bêta) avec les notes générées depuis les PR fusionnées.
3. Relire les notes puis publier la release sur GitHub : les applications ne voient que les releases publiées.
