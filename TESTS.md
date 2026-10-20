# Vérifications de Sillage 11.4

## Correctif 11.4.1

80 tests Node et 183 tests API réussis. Le nouveau scénario `calendar-envelope-renewals-ui.py` reproduit d’abord le renouvellement invisible, puis vérifie trois semaines consécutives en largeur ordinateur et iPhone, sans changement des prévisions, soldes ni données. Les scénarios existants `planning-v4-ui.py`, `refactor-parity-ui.py` (40 combinaisons) et `installed-assets-ui.py` passent également. La suite complète des 56 scripts Python n’a pas été relancée pour ce correctif ciblé; le rapport complet ci-dessous concerne la v11.4.0.

Les essais utilisent des données fictives et des dossiers temporaires. Ils ne lisent pas les finances du Mac de l’utilisateur.

## Exécuter les contrôles

Node.js 22.13+ (Node 24 recommandé), Python 3, Playwright et Chromium sont nécessaires pour la totalité des vérifications. L’application elle-même ne nécessite aucun paquet npm.

```sh
npm test
python3 tests/run-python-checks.py --results /tmp/sillage-checks --jobs 2
```

Le premier lance les tests Node puis les tests API. Le second exécute chaque script Python supplémentaire, conserve chaque journal et renvoie un échec si un script échoue. Aucun test n’est ignoré automatiquement. `CHROMIUM_PATH` permet d’utiliser un Chromium installé sur la machine.

## Résultat final de la v11.4

**80 tests Node, 183 tests API et 55 scripts Python réussis.** La dernière exécution complète termine sans échec. Le [rapport de validation](docs/phases-2-5-validation.md) et les [résultats détaillés](docs/phases-2-5-results.json) conservent les preuves et les corrections apportées aux attentes des tests.

## Comparaison avant/après

`tests/refactor-parity-ui.py` extrait la référence v11.3 figée au commit `731a58b68532e67ac9f63e6765752db34ee32d9c`. La même base fictive est utilisée pour comparer les tables financières, les réserves et les prévisions de 90 jours. Il compare aussi les styles visibles de dix écrans, en clair et sombre, aux largeurs 390 et 1440 pixels : 40 combinaisons.

Les tests d’interface historiques ont été adaptés aux menus, dialogues et sections repliées de l’interface actuelle. Leurs assertions de montants, de persistance et d’absence d’écritures pendant la consultation sont conservées.

## Couverture de robustesse

- Migrations sur ancienne base, reprise après erreur, sauvegarde SQLite cohérente et restauration réelle avec redémarrage.
- Retour effectif au code v11.1, y compris une transaction créée après mise à jour.
- Installation simulée, démarrage/arrêt du service, copie complète des ressources et validation avant arrêt du service existant.
- Accès propriétaire et consultation limitée : identité Tailscale, hôte, absence de privilège par faux en-têtes, création/révocation et refus des jetons malformés.
- Corps JSON : tailles en octets, UTF-8 fragmenté, limites, type MIME exact, refus sans mutation.
- Ressources statiques autorisées et modules versionnés; absence d’exécution de HTML injecté dans les libellés.
- Safe-to-Spend, enveloppes, cartes, récurrences, budgets calendaires, rapprochements, vue simplifiée et simulations d’achat.

Les essais de navigateur utilisent Chromium sous Linux. Ils ne remplacent pas une vérification sur Safari/iOS et un vrai Mac avec `launchd`, Gatekeeper et Tailscale Serve.

L’[archive des anciens rapports](docs/tests-archive.md) conserve notamment la référence des étapes 0 et 1, avec les échecs d’interface historiques constatés à cette époque. Les nouveaux résultats ne réécrivent pas cet historique.
