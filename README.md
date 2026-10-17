# Mon Budget 3

Application de budget locale, en français canadien, pour Mac. Vos données restent dans une base SQLite sur votre ordinateur. Node.js **22.13 ou plus** est requis; Node.js 24 LTS est recommandé. Aucun CDN, aucune compilation et aucune dépendance npm externe.

```sh
npm start
```

Ouvrez `http://127.0.0.1:3030`. Le serveur écoute uniquement sur l’interface locale. Il crée `data/` dans le dossier depuis lequel il est lancé. Les fichiers de l’application doivent rester ensemble.

## Mettre à jour sur Mac

**La v3 modifie aussi le serveur. La mise à jour des trois fichiers visuels ne suffit plus.**

1. Arrêtez le serveur avec Control + C.
2. Faites une copie **complète** du dossier actuel, avec `data/`, `budget.sqlite` et les éventuels fichiers `-wal` et `-shm`.
3. Décompressez le nouveau ZIP dans un **nouveau dossier distinct**, par exemple `Mon-Budget-3`. Gardez tous ses fichiers ensemble.
4. **Copiez** votre ancien dossier `data/` dans ce nouveau dossier, au même niveau que `server.js`. Gardez l’original intact; le ZIP ne contient aucun dossier de données.
5. Depuis le nouveau dossier, ouvrez `Lancer Mon Budget.command` ou lancez `npm start`, puis rechargez Safari avec Cmd + Option + R.

Les nouveaux fichiers `budget-features.js` et `features.js` sont indispensables. Ne mélangez pas l’ancien serveur avec les nouveaux fichiers visuels.
La migration v3 est additive. Avant ses ajouts, une copie SQLite cohérente est créée dans `data/backups/budget-before-v3.sqlite`. Vos transactions existantes restent sans catégorie jusqu’à leur classement; les soldes et réserves sont conservés. Une modification de catégorie ou de description seule ne recalcule pas les réserves historiques.

Instructions détaillées et procédure de retour à la version précédente : [INSTALLATION-MAC.txt](INSTALLATION-MAC.txt).

## Un lancement plus simple sur Mac

Le fichier exécutable **Lancer Mon Budget.command** lance le serveur et ouvre le navigateur. Il détecte une instance v3 déjà ouverte sur le port 3030. Gardez sa fenêtre Terminal ouverte; Control + C arrête le serveur qu’il a lancé. Vérifiez que vous utilisez le bon dossier de données si une autre instance est déjà ouverte.

Ce lanceur nécessite Node.js et n’est pas une application `.app` signée et autonome. Le démarrage réel dans Finder/Safari reste à vérifier sur Mac; la syntaxe du script est vérifiée dans l’environnement de développement.

## Tableau de bord et prévisions

- Disponible actuel, enveloppes réservées et minimum prévu sur 90 jours.
- Montant prudent aujourd’hui, cette semaine et jusqu’à la prochaine paie détectée.
- Graphique interactif sur 30 jours avec graduations, dates, minimum et avertissement sous zéro.
- Survol, toucher ou navigation clavier : Tab atteint le point sélectionné, les flèches changent de jour, Début/Fin atteignent les extrémités.
- Tableau des montants et mouvements quotidiens accessible sous le graphique.
- Enveloppes et cinq prochains mouvements à côté du graphique sur ordinateur; disposition adaptée au mobile.

Les règles récurrentes servent à la prévision. Elles ne déclenchent aucun virement bancaire. Les soldes bancaires et les transactions sont saisis ou importés manuellement. Sans paie prévue sur 30 jours, aucun montant « jusqu’à la paie » n’est inventé.

![Tableau de bord avec données fictives](docs/tableau-de-bord.png)

## Transactions et catégories

Choisissez **Dépense** ou **Revenu**, puis entrez un montant positif. Les descriptions récentes sont suggérées. Chaque transaction peut avoir une catégorie et, pour une dépense, une enveloppe.

Les **catégories** servent à analyser les dépenses; les **enveloppes** réservent de l’argent dans le disponible. Les deux fonctions sont indépendantes.

L’historique propose recherche, filtres de compte, de catégorie, de type, de révision et de dates. L’export CSV inclut **tous les résultats filtrés**, au-delà de la page affichée. Les descriptions susceptibles d’être interprétées comme des formules par un tableur sont neutralisées dans cet export.

Une dépense sur crédit augmente la dette. Un paiement de carte doit être enregistré comme un **virement** depuis le compte bancaire vers la carte, pour éviter une deuxième dépense.

## Bilan mensuel

Le bilan utilise toutes les transactions du mois sélectionné, avec un filtre facultatif par compte : revenus, dépenses, différence et répartition des dépenses par catégorie. Les virements et corrections de solde sont exclus.

Les transactions positives figurent dans les revenus et les négatives dans les dépenses; cela inclut les remboursements saisis comme montants positifs. Ce bilan décrit les opérations, sans calcul comptable du revenu imposable.

Vous pouvez créer des catégories et définir un plafond mensuel pour chacune. Ce plafond récurrent s’applique à chaque mois consulté, sans historique de versions; il ne réserve pas d’argent. Le montant non classé reste visible.

![Bilan avec données fictives](docs/bilan-mensuel.png)

## Import bancaire CSV

L’import comporte trois étapes : fichier/compte, association des colonnes et aperçu avec sélection des opérations.

- CSV **UTF-8** avec ligne de titres; virgule, point-virgule ou tabulation.
- Guillemets, séparateurs dans les descriptions et cellules multilignes pris en charge.
- Dates ISO `AAAA-MM-JJ`, ou choix explicite jour/mois/année et mois/jour/année.
- Montant signé ou colonnes débit/crédit séparées. Option d’inversion du signe pour certains relevés de carte.
- Montants localisés tels que `1 234,56`, `1,234.56` et montants entre parenthèses.
- Catégorie par défaut, ou colonne catégorie si son nom correspond à une catégorie existante; sinon la catégorie par défaut s’applique.
- Maximum 2 Mo et 2 000 opérations par fichier. Les lignes invalides ne sont pas importables.

Le mode par défaut **historique seulement** conserve les soldes et les réserves actuels. Ces opérations sont marquées dans l’historique; leur modification ou suppression ultérieure ne recalcule pas les soldes. Le mode **appliquer aux soldes** sert aux opérations qui ne sont pas déjà comprises dans les soldes saisis. Aucun mode d’import ne consomme d’enveloppe.

Un doublon possible correspond au même compte, à la même date, au même montant et à la même description, sans distinction de casse et après suppression des espaces aux extrémités. Ils sont décochés par défaut. Vous pouvez autoriser leur sélection après vérification. Des achats légitimement identiques peuvent être signalés; les descriptions bancaires différentes peuvent ne pas être reconnues.

Les virements et remboursements de carte ne sont pas automatiquement identifiés : décochez-les dans l’aperçu et saisissez-les comme virements. Le serveur revérifie les doublons au moment de confirmer et importe la sélection en une seule transaction SQLite.

![Aperçu CSV avec données fictives](docs/import-csv.png)

## Comparer les soldes

Dans **Comptes**, entrez le solde bancaire actuel et une note. L’application affiche le solde enregistré et l’écart, puis demande confirmation de la correction. Elle conserve l’ancien et le nouveau solde dans un historique, sans créer de revenu ni de dépense.

Il s’agit d’une comparaison et d’une correction du **solde actuel**, pas d’un rapprochement exhaustif des lignes d’un relevé à une date passée. Si le compte a changé depuis l’aperçu, la correction est refusée : comparez de nouveau.

## Objectifs d’épargne

Définissez un montant cible, le montant déjà épargné et une date facultative. La progression et un repère mensuel sont affichés. Il s’agit d’un **suivi manuel** : créer ou modifier un objectif ne déplace pas d’argent et ne crée aucune réserve dans le disponible. Le repère mensuel ne simule pas d’intérêts.

## Sauvegardes et restauration

Depuis **Sauvegardes**, téléchargez une copie JSON complète : comptes, transactions, catégories, enveloppes, règles, exceptions, rapprochements, plafonds, imports et objectifs. Le format de sauvegarde est identifié par `format: "mon-budget"` et `version: 1`.

La restauration accepte un export JSON v3 complet, jusqu’à 8 Mo et 100 000 lignes au total. Elle vérifie d’abord les tables, types, contraintes, dates et liens dans une base temporaire. Vous devez ensuite taper `REMPLACER`. Juste avant le remplacement atomique, une copie JSON du budget actuel est conservée dans `data/backups/`.

Les copies SQLite automatiques ne sont pas des fichiers JSON à téléverser dans cet écran. Conservez ces fichiers et une copie du dossier complet pour la récupération manuelle. Une sauvegarde contient des données financières personnelles : gardez-la dans un endroit privé.

## Règles et limites conservées

- Prévisions sur 90 jours et graphique sur 30 jours; pas de prévisions rétrospectives.
- Le calendrier utilise les 50 dernières transactions réelles de `/api/state`; l’historique paginé reste complet.
- Récurrences, rapprochement automatique conservateur et liens manuels, déplacements d’occurrences et budgets exceptionnels d’enveloppes restent disponibles.
- Les règles mensuelles du dernier jour ouvrable excluent les week-ends; vérifiez les jours fériés et conventions de l’organisme payeur.
- Pour les nouvelles dépenses v3, la réserve effectivement consommée est mémorisée pour les corrections/suppressions. L’effet exact d’anciennes dépenses plafonnées n’est pas reconstructible : vérifiez l’enveloppe après une modification de montant sur une ancienne opération.
- Ne lancez pas deux serveurs sur la même base.
- Pas de connexion automatique à votre banque ni d’application Mac autonome signée.
- Vérifiez les soldes et les prévisions sur une copie de vos données avant utilisation quotidienne.

## Développement et vérifications

Aucune dépendance d’exécution externe. Les tests API nécessitent Python 3; les tests navigateur nécessitent en plus Playwright pour Python et Chromium.

```sh
node --test tests/csv.test.js
python3 tests/api-tests.py
```

Les tests n’utilisent que des bases temporaires et des données fictives. Ils vérifient notamment les signes des opérations sur crédit, les enveloppes plafonnées, le classement des anciennes transactions, la migration, les bilans complets, les imports invalides et doublons, les corrections concurrentes, les restaurations refusées et les copies de sécurité.

```sh
python3 -m venv /tmp/budget-ui-venv
/tmp/budget-ui-venv/bin/python -m pip install playwright
/tmp/budget-ui-venv/bin/python -m playwright install chromium
/tmp/budget-ui-venv/bin/python tests/ui-smoke.py
/tmp/budget-ui-venv/bin/python tests/workflows-ui.py
```

`CHROMIUM_PATH` permet de choisir un exécutable existant. Les captures sont enregistrées dans un dossier temporaire indiqué à la fin. Voir [TESTS.md](TESTS.md) pour les résultats et leurs limites. Safari et Finder réels restent à vérifier sur Mac.
