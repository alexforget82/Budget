# Vérifications de Sillage 11.4

## Export ChatGPT — 11.4.3

**97 tests Node et 188 tests API réussis**, y compris les contrôles de confidentialité et d’accès de l’export. Le parcours `chatgpt-export-ui.py` passe sur ordinateur/iPhone, en clair/sombre, avec panne/reprise et téléchargement du contenu vérifié. La copie installée, la simulation du service et les 40 comparaisons historiques passent. La suite Python complète n’a pas été relancée. Voir [le guide et le relevé détaillé](docs/chatgpt-export-11.4.3.md).

## Vérification complémentaire des enveloppes

**95 tests Node et 186 tests API réussis**, sans nouveau changement du code applicatif v11.4.2. Les huit tests de `envelope-protection-matrix.test.js` couvrent 304 configurations. Voir la [vérification détaillée](docs/protection-periodes-11.4.2.md#vérification-complémentaire-de-tous-les-types-denveloppes).

## Correctif 11.4.2

**87 tests Node et 186 tests API réussis.** Sept nouveaux tests Node et trois tests API vérifient les réservations par période et l’absence de double comptage. La suite complète des scripts supplémentaires donne **55/56**; le test historique `categories-v46-ui.py` échoue de manière intermittente sur le rappel marchand, puis réussit à la relance ciblée, sans modification de ce test dans cette version. Le nouveau calendrier, les prévisions, l’installation, les sauvegardes, le retour au code précédent et les vues partagées passent.

[Explication du correctif et exemple du 28/29 octobre](docs/protection-periodes-11.4.2.md) · [Résultats détaillés avec l’échec et la relance](docs/protection-periodes-11.4.2-results.json). La comparaison historique utilise désormais une enveloppe avec report actif; le changement intentionnel du calcul sans report est vérifié dans les nouveaux tests.

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

## Vérification de la v11.5.0

**97 tests Node, 188 tests API et 58 scripts Python réussis** sur données temporaires. La dernière exécution complète termine sans échec; ses [résultats détaillés](docs/iphone-115-results.json) sont conservés. Le parcours `mobile-v115-ui.py` vérifie cinq largeurs de téléphone en clair et sombre, neuf écrans, le retour sur ordinateur et une transaction enregistrée exactement une fois. Les tables financières et les prévisions restent identiques pendant la consultation. Le [guide mobile](docs/iphone-11.5.md) présente les captures et les limites des essais sur émulateur.

## Résultat final de la v11.4

**80 tests Node, 183 tests API et 55 scripts Python réussis.** La dernière exécution complète termine sans échec. Le [rapport de validation](docs/phases-2-5-validation.md) et les [résultats détaillés](docs/phases-2-5-results.json) conservent les preuves et les corrections apportées aux attentes des tests.

## Comparaison avant/après

`tests/refactor-parity-ui.py` extrait la référence v11.3 figée au commit `731a58b68532e67ac9f63e6765752db34ee32d9c`. La même base fictive est utilisée pour comparer les tables financières, les réserves et les prévisions de 90 jours. Il compare aussi les styles visibles de dix écrans, en clair et sombre, sur ordinateur à 1440 pixels : 20 combinaisons. La présentation téléphone, volontairement remaniée en v11.5, possède son propre parcours `mobile-v115-ui.py` : cinq largeurs, neuf écrans, deux thèmes, navigation, filtres, sélection multiple, saisie, clavier simulé et retour à la disposition ordinateur.

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
