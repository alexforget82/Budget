# Vérifications de Sillage

## v13.1.0 — paiement réel et confort iPhone

**113 tests Node, 201 tests API historiques et 64 scripts Python réussis.** Le premier passage complet Python donne 64/64. Le nouveau cas API vérifie aperçu sans écriture, paiement partiel, protection d’achat récurrent et d’enveloppe, dette non protégée, compte exclu, soldes réels, minimum projeté, reconnaissance d’un remboursement prévu unique, doublon, confirmation à usage unique et aperçu périmé. Les tests Node supplémentaires vérifient expiration, immutabilité du montant confirmé, données modifiées et échec d’écriture.

Le nouveau parcours UI couvre cinq largeurs et les deux thèmes, la présélection du Conjoint et du montant protégé, les modifications après aperçu, la confirmation avec données concurrentes, l’enregistrement d’un seul virement et l’avertissement de doublon. Des changements de visualViewport simulent le clavier et le zoom, sans prétendre tester le véritable iOS. L’API ciblée et le parcours UI sont relancés après les derniers ajustements du nouveau parcours.

[Guide et captures](docs/SILLAGE-13.1.md) · [Résultats](docs/v131/checks.json). Aucun changement de schéma. Les règles de protection existantes restent celles du moteur canonique. Les essais utilisent uniquement des bases fictives temporaires sous Chromium.

## v13.0.0 — refonte visuelle

**110 tests Node, 201 tests API et 62 parcours Python validés.** Le premier passage Python donne 57/62; les cinq échecs sont résolus et relancés : raccourci prochaine rentrée, densité des transactions sur petit écran, ouverture des options d’enveloppes dans le parcours historique, couleur sombre attendue et remplacement de l’ancienne exigence de styles identiques par la validation de la nouvelle présentation. Les assertions financières historiques restent actives. Le nouveau parcours v13 est relancé après les derniers ajustements.

Le parcours `visual-v13-ui.py` vérifie les montants actuels et les extrêmes des trois horizons contre l’état serveur, la décomposition sans double comptage des protections sur carte, huit largeurs de 320 à 1920 pixels et neuf écrans dans les deux thèmes. Il vérifie aussi recherche/filtres, édition des enveloppes, état après rafraîchissement, tableau de bord personnalisable, vue partagée et absence d’écritures financières pendant la navigation.

[Guide et captures](docs/SILLAGE-13.md) · [Relevé des résultats](docs/v13/checks.json). Les essais utilisent uniquement des bases temporaires fictives sous Chromium. Aucun essai sur iPhone physique ou Safari réel. Aucun changement du moteur financier ni du schéma de la base.


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

## Vérification de la v12.0.0

**110 tests Node, 201 tests API et 61 parcours Python validés.** La suite Python initiale donne 59/61 : le test de migration attendait une base sans le nouveau réglage d’activation; le test de budget libre pouvait modifier le budget avant réception de son aperçu. Après adaptations ciblées, les deux repassent, en conservant les assertions financières et la protection contre les aperçus périmés. Six parcours concernés ont été recontrôlés, ainsi que le chargement d’une interface dont la version diffère du serveur. Les [résultats](docs/v12-results.json) conservent l’exécution initiale et les recontrôles.

Les nouveaux tests couvrent Apple One à 53,98 $, achats réels/anticipés, association explicite de montant différent, annulation d’une occurrence, remboursements partiels/complets, absence de double réserve avec une enveloppe, dette ancienne exclue, changement/suppression de règle, modification/suppression de transaction, réutilisation d’identifiant, restauration, annulation et métadonnées de sauvegarde invalides. L’ancienne assertion qui laissait un achat récurrent sur carte sans protection est remplacée par la baisse du disponible à la date d’achat, avec solde bancaire inchangé et effet nul du remboursement sur la somme déjà protégée.

La lecture publique des versions est testée avec réponses contrôlées (nouvelle version, pas de mise à jour, manifeste invalide, erreur, taille excessive). La requête GitHub réelle n’a pas abouti dans cet environnement; elle renvoie une erreur sans interrompre le budget. Les essais d’iPhone restent des émulations Chromium; le [guide sur appareil](docs/IPHONE-12.md) décrit les vérifications Safari/iOS à faire après installation.

## Vérification de la v11.6.0

97 tests Node et 195 tests API réussis. La suite complète donne 59/60 scripts Python; le seul échec compare l’ancien tableau de bord avec le nouveau panneau de vérification ajouté. Après exclusion ciblée de ce nouveau panneau de la comparaison historique, le contrôle repasse : les 20 combinaisons de styles existants et les chiffres restent identiques. Le nouveau panneau et les aperçus sont couverts séparément par `confidence-v116-ui.py`, également repassé après les derniers ajustements mobiles. Les 60 parcours sont ainsi validés, sans modification des assertions financières. Les [résultats](docs/confiance-116-results.json) conservent l’exécution initiale et les recontrôles.

Le [guide](docs/confiance-11.6.md) décrit le calcul détaillé et l’aperçu des corrections. Les deux nouvelles vérifications API comparent le résultat théorique à une correction réelle sur données temporaires et contrôlent l’absence d’écriture pendant la comparaison.

## Vérification de la v11.5.2

97 tests Node et 193 tests API réussis. Le nouveau cas couvre une enveloppe avant sa première échéance et sans calendrier. Le parcours navigateur d’épicerie vérifie que la carte reste visible dans ces deux situations et disparaît après révocation; le parcours de simulation simplifiée reste vert.

## Vérification de la v11.5.1

97 tests Node et 192 tests API réussis. Quatre nouveaux cas API couvrent le suivi d’épicerie : absence/ambiguïté/inactivité, budget hebdomadaire, achats bancaires et sur carte, dépassement, report réel, exception de montant et achats associés à une autre période. Six parcours navigateur ciblés vérifient l’épicerie, la vue simplifiée existante, les périodes, les chiffres du propriétaire, la confidentialité et la comparaison financière avec la référence. Les autres résultats complets ci-dessous correspondent à la v11.5.0.

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
