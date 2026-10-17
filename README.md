# Mon Budget 3.5

Application de budget locale, en français canadien, pour Mac. Vos données restent dans une base SQLite sur votre ordinateur. Node.js **22.13 ou plus** est requis; Node.js 24 LTS est recommandé. Aucun CDN, aucune compilation et aucune dépendance npm externe.

```sh
npm start
```

Ouvrez `http://127.0.0.1:3030`. Le serveur écoute uniquement sur l’interface locale. Il crée `data/` dans le dossier depuis lequel il est lancé. Les fichiers de l’application doivent rester ensemble.

## Fréquences de factures — v3.5

Dans **Planifier → Récurrences**, une facture peut revenir chaque semaine, aux 2 semaines, chaque mois, aux 3 mois, aux 6 mois ou chaque année. Les mêmes choix sont disponibles lors de sa modification. Les prévisions, le calendrier et les exceptions utilisent ces dates. Une échéance au 31 est ramenée au dernier jour des mois plus courts, puis retrouve son jour d’origine; le 29 février annuel revient au 28 février hors année bissextile. Les ajustements de jours ouvrables continuent de s’appliquer.

La migration conserve les identifiants des règles et leurs associations et crée préalablement `data/backups/budget-before-extended-recurrences.sqlite`. Ces nouvelles fréquences concernent les récurrences de factures; les fréquences des enveloppes et des plans de remboursement de cartes restent les mêmes.

## Nouveau : remboursements de cartes prévus

Dans **Comptes → CIBC → Planifier les remboursements**, choisissez **Conjoint**, la première date et la fréquence. Deux modes sont disponibles : **selon les achats** de la période ou **montant fixe**. Si un virement récurrent existe déjà, sélectionnez-le pour le réutiliser.

Un achat d’épicerie de 230 $ sur CIBC le jeudi augmente le solde de la carte; son remboursement prévu le vendredi diminue Conjoint à cette date. Le calendrier distingue les deux. Le détail du plan explique les achats, remboursements marchands et reports qui composent chaque proposition. Le mode calculé ne rembourse pas automatiquement l’ancien solde total de la carte et ne crée **aucune réserve automatique pour les cartes**.

Le calcul inclut les achats réels et prévus de chaque période, les remboursements marchands et les achats non remboursés après un paiement partiel. Une carte déjà créditrice limite le montant proposé. Vous pouvez ajuster une échéance dans le suivi. L’application ne fait aucun virement bancaire : confirmez uniquement les paiements réellement effectués. Si un virement est déjà saisi, associez-le dans **À confirmer**; un paiement distinct demande une confirmation explicite pour éviter un double débit.

La configuration du plan ne modifie pas vos soldes réels. Une copie SQLite est créée avant la migration dans `data/backups/budget-before-card-payments.sqlite`. Les anciennes sauvegardes JSON restent importables. Les prévisions historiques utilisent les règles actuelles; elles ne constituent pas un historique immuable des anciennes règles.

[Aperçu du plan de remboursement](docs/remboursement-carte.png) · [Aperçu mobile](docs/mobile-remboursement.png) — données fictives.

## Mettre à jour sur Mac

**La v3 modifie aussi le serveur. La mise à jour des trois fichiers visuels ne suffit plus.**

1. Arrêtez le serveur avec Control + C.
2. Faites une copie **complète** du dossier actuel, avec `data/`, `budget.sqlite` et les éventuels fichiers `-wal` et `-shm`.
3. Décompressez le nouveau ZIP dans un **nouveau dossier distinct**, par exemple `Mon-Budget-3`. Gardez tous ses fichiers ensemble.
4. **Copiez** votre ancien dossier `data/` dans ce nouveau dossier, au même niveau que `server.js`. Gardez l’original intact; le ZIP ne contient aucun dossier de données.
5. Depuis le nouveau dossier, ouvrez `Lancer Mon Budget.command` ou, pour conserver l’accès iPhone, `Acces prive iPhone.command`. Vous pouvez aussi lancer `npm start`. Puis rechargez Safari avec Cmd + Option + R.

Les fichiers `budget-features.js`, `features.js`, `planner.js`, `transactions.js`, `forecast-engine.js`, `forecast-ui.js`, `planning-actions.js` et `planning-workflow.js`, `card-payments.js`, `card-payments-engine.js` et `card-payments-ui.js` sont indispensables. Ne mélangez pas l’ancien serveur avec les nouveaux fichiers visuels.
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

## Accès privé depuis l’iPhone (3.3)

Vous pouvez conserver les données sur votre Mac et consulter le même budget depuis l’iPhone, y compris hors de la maison, grâce à **Tailscale sur les deux appareils**. Le Mac doit rester allumé et connecté.

Le nouveau lanceur **Acces prive iPhone.command** prépare une adresse HTTPS privée et réserve l’accès distant au compte propriétaire fourni par Tailscale Serve. L’accès local reste disponible; aucun port n’est ouvert sur le routeur et aucun Funnel n’est activé. Le fichier `private-access.js` doit rester avec le serveur. La configuration personnelle est enregistrée dans `data/private-access.json`, hors du dépôt.

Consultez [le guide Mac + iPhone](ACCES-IPHONE.md) pour l’installation, la mise à jour, le lancement, l’ajout à l’écran d’accueil et les limites. L’installation effective de Tailscale sur vos appareils reste nécessaire; elle n’est pas réalisée depuis cet environnement. Aucun mode hors ligne ni hébergement permanent n’est ajouté.

## À confirmer et explication du solde (3.2)

**Planifier → Prévu / Réel → À confirmer** est le point de départ quotidien. La liste distingue les opérations en retard, celles d’aujourd’hui et les prochaines échéances. Les filtres donnent accès aux opérations à traiter, aux sept prochains jours ou aux 90 jours disponibles. Les réservations internes n’apparaissent pas comme des paiements bancaires à confirmer. Les éléments sans configuration complète restent signalés.

- **Confirmer le réel** : indiquez le montant effectivement passé et sa date. Si la transaction est déjà saisie, choisissez **Déjà saisie — associer l’opération** pour ne pas la débiter à nouveau. La confirmation crée, au besoin, une seule transaction ou un seul virement, puis le rattache à son échéance.
- **Enveloppe avec plusieurs achats** : décochez **Aucun autre achat prévu pour cette période**. Seul le budget restant reste projeté; une confirmation ultérieure termine la période. Le total réel peut différer du budget initial.
- **Modifier le prévu** : change le budget de cette occurrence, sans modifier les autres dates ni les soldes réels.
- **Reporter** : déplace une seule sortie ou un seul revenu, dans la limite des 90 jours autorisés. Pour une enveloppe, le renouvellement de la réserve conserve sa date habituelle; seule la dépense est déplacée.
- **Annuler** : retire l’occurrence de la simulation sans créer de transaction. L’**Historique complet** permet de la retrouver et de la rétablir.

Une confirmation d’enveloppe conserve le lien avec sa période d’origine même si l’achat est enregistré plus tard. La suppression de cet achat rétablit la prévision correspondante. Deux validations de la même fiche ne créent pas deux opérations; une fiche devenue obsolète affiche une erreur et propose d’actualiser la liste. Les montants réels doivent être datés d’aujourd’hui ou d’un jour passé.

Dans **Planifier → Prévision**, choisissez une date. Le panneau **Pourquoi ce solde ?** explique :

**Solde réel de départ + revenus prévus − factures − dépenses d’enveloppes + virements nets = solde bancaire prévu.** Les réserves d’enveloppes restantes sont ensuite déduites pour obtenir le disponible prévu.

Chaque groupe se déplie pour voir les mouvements et leur effet bancaire exact. Un virement entre deux comptes inclus est visible avec un effet net nul; un paiement de carte ou un virement vers un compte exclu apparaît comme une sortie. Les revenus en retard non confirmés ne sont pas ajoutés au solde. Les opérations réelles déjà enregistrées sont comprises dans le solde de départ. Les chiffres se mettent à jour avec la date, le curseur ou l’horizon.

**Aucune réserve automatique n’est créée pour les cartes**, conformément au fonctionnement choisi. Cette mise à jour ne change pas cette règle.

La migration est additive et crée une copie cohérente dans `data/backups/budget-before-planning-actions.sqlite`. Les anciens exports JSON v3 et v3.1 restent restaurables. Le suivi est recalculé à partir des règles actuelles; il ne constitue pas une archive immuable des anciennes prévisions.

![À confirmer — données fictives](docs/a-confirmer.png)

![Explication d’un solde — données fictives](docs/explication-solde.png)

## Prévision complète et suivi réel (3.1)

Dans **Planifier → Prévision**, choisissez une date (jusqu’à 90 jours) et consultez séparément le **solde bancaire prévu**, les **réserves d’enveloppes**, le **disponible prévu**. Le sélecteur de courbe permet de passer du disponible au solde bancaire. Le disponible réel d’aujourd’hui reste distinct de la simulation des mouvements attendus aujourd’hui.

- Enveloppe en **Dépense prévue** : son budget est une sortie bancaire à chaque date programmée. Exemple : 230 $ les 22 et 29 octobre et le 5 novembre = 690 $ de dépenses projetées au 5 novembre.
- Choisissez le compte de chaque enveloppe. Sans compte attribué, la dépense est tout de même déduite du total des comptes inclus, avec un avertissement; elle n’est pas attribuée arbitrairement à un compte.
- Enveloppe **Réserve seulement** : adaptée à l’épargne, sans sortie bancaire automatique. Ses renouvellements continuent de réserver l’argent.
- Revenus, dépenses, virements, budgets exceptionnels, annulations et dates déplacées sont intégrés. Une règle peut maintenant être **ponctuelle**. Une dépense récurrente peut être liée à une enveloppe : elle remplace la dépense automatique de cette enveloppe pour la période correspondante, sans masquer les autres périodes.
- Les soldes dus sur les cartes ne créent **aucune réserve automatique** et ne sont pas déduits du Safe-to-Spend. Les achats sur crédit augmentent la dette suivie séparément. Seuls les virements de remboursement prévus ou enregistrés réduisent le solde bancaire et le disponible.

Dans **Planifier → Prévu / Réel**, les cartes présentent **Prévu / Réel / Écart**, avec des filtres de mois et de statut. Les transactions réelles sans prévision associée sont également visibles et sont déjà incluses dans les soldes.

**Enveloppes :** associez vos achats réels à l’enveloppe. Les dépenses entre une date programmée et la veille de la suivante sont additionnées. Par défaut, dès qu’un achat est enregistré, ce total réel remplace le budget de la période. Pour prévoir d’autres achats, cliquez **Encore des achats** : seul le budget restant sera projeté. **Terminer la période**, **Annuler la dépense prévue** et **Calcul automatique** permettent de corriger ce suivi. Le reste réellement réservé demeure dans l’enveloppe jusqu’à son ajustement ou son renouvellement, selon son mode de report; il n’est pas libéré silencieusement.

**Récurrences :** un rapprochement automatique exige compte, montant, description et date compatibles, sans ambiguïté. Si le montant réel diffère, utilisez **Associer un réel**. L’association ne modifie pas les soldes. Les achats sur carte se saisissent comme dépenses; les remboursements comme virements.

Les dépenses et virements passés non confirmés restent déduits prudemment à partir d’aujourd’hui. Les revenus en retard ne financent pas le disponible avant leur rapprochement. Le calendrier conserve la date prévue d’origine et affiche les dépenses d’enveloppes et les opérations réelles, y compris au-delà des 50 dernières transactions.

Le suivi commence à l’activation de cette version : les prévisions historiques antérieures ne sont pas inventées. Les prévisions sont recalculées à partir des règles actuelles; ce n’est pas un archivage figé des anciennes versions du budget. Une date, une fréquence ou un budget manquant est signalé. Les opérations futures déjà saisies comme réelles sont signalées : leurs montants sont déjà dans les soldes; utilisez plutôt une opération prévue pour les prochains paiements. Vérifiez les transactions ambiguës et les affectations d’enveloppes avant de vous fier aux chiffres.

La migration ajoute des champs et une table de suivi, sans réécrire les opérations existantes. Une copie SQLite est conservée dans `data/backups/budget-before-planning-v4.sqlite`. Les sauvegardes JSON v3 antérieures restent restaurables.

![Prévu et réel — données fictives](docs/prevu-reel.png)

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


## Comptes et Planifier — interface repensée

Une seule entrée **Planifier** dans le menu principal ouvre un espace avec onglets : Vue d’ensemble, Récurrences, Enveloppes, Objectifs et Calendrier. Sur mobile, le menu des écrans se déplie; le bouton d’ajout de transaction reste visible.

- **Comptes** : synthèse des soldes bancaires, fonds inclus et cartes; cartes individuelles, interrupteurs d’inclusion et modification. La comparaison de solde s’ouvre à la demande.
- **Prévision** : horizons de 30, 60 et 90 jours, courbe du disponible, début/minimum/fin, avertissement sous zéro et détail d’une journée. Un curseur accessible au clavier, les dates et les cartes de semaines permettent de parcourir la période. Quatre semaines sont présentées à la fois; les autres sont accessibles par les flèches. La liste quotidienne complète sur 90 jours reste disponible dans un volet fermé par défaut.
- **Enveloppes** : réserves, budgets, renouvellements et dépenses par période dans des cartes. Le budget exceptionnel est rangé dans un volet.
- **Récurrences** : cartes filtrables par type; prochaine occurrence visible dans la prévision, modification, pause et suppression. Le rapprochement manuel s’ouvre au besoin.
- **Objectifs** : cartes de progression et formulaire dans une fenêtre dédiée.
- **Calendrier** : grille mensuelle sur ordinateur et mobile, repères sur les jours avec mouvements et détail au clic.

Ces vues lisent les prévisions du serveur; elles ne modifient pas les règles financières. Les cartes de semaine correspondent à des blocs de sept jours à partir du premier jour de la prévision, pas nécessairement du lundi au dimanche. Le minimum affiché correspond à l’horizon sélectionné.

![Comptes avec données fictives](docs/comptes.png)

![Prévision 90 jours avec données fictives](docs/prevision-90-jours.png)

[Aperçu des enveloppes](docs/enveloppes.png) · [Aperçu des récurrences](docs/recurrences.png) · [Prévision mobile](docs/mobile-prevision.png)

Test supplémentaire : `python3 tests/planning-ui.py` (mêmes prérequis Playwright que les autres tests navigateur).


## Transactions au quotidien

L’historique regroupe les opérations par journée, avec catégorie, compte, montant et état de révision. Un clic sur **À vérifier / Révisée** change l’état sans toucher au montant. **Modifier** ouvre l’éditeur; le menu `•••` propose la suppression et la préparation d’une nouvelle opération similaire.

- Recherche sans distinction de casse ou d’accents : `cafe` retrouve `CAFÉ`. Les caractères `%`, `_` et `\` sont recherchés littéralement.
- Filtres rapides Tout / Dépenses / Revenus / À vérifier, compte et périodes prédéfinies. Catégorie, dates personnalisées et état de révision restent dans les filtres avancés.
- Totaux des dépenses, revenus et opérations à vérifier calculés sur **tous les résultats filtrés**, au-delà de la page de 50 lignes. Ils décrivent les transactions, pas votre solde bancaire.
- Une requête de recherche plus ancienne ne remplace pas les résultats d’une recherche plus récente. En cas d’erreur de lecture, les totaux sont retirés et un bouton de nouvelle tentative apparaît.
- Après suppression de la dernière opération d’une page, l’historique revient à une page existante.

L’ajout commence par Dépense/Revenu, le montant et la description. Les commerces récents proposent la catégorie de leur dernière opération lorsqu’elle est du même type. La proposition reste modifiable et ne remplace pas une catégorie choisie manuellement. Le compte et le montant ne sont pas copiés par ces suggestions. Un changement Dépense/Revenu efface la catégorie précédente avant une éventuelle nouvelle proposition.

**Enregistrer et continuer** conserve l’éditeur ouvert et efface le montant et la description après succès. **Refaire cette opération** prépare une copie à la date du jour, avec compte, catégorie et enveloppe; elle n’est enregistrée qu’après confirmation dans le formulaire et modifie alors les soldes comme une nouvelle opération réelle. Fermer la fenêtre conserve le brouillon dans la page en cours.

![Historique avec données fictives](docs/transactions.png)

![Saisie avec données fictives](docs/saisie-transaction.png)

[Aperçu mobile de l’historique](docs/mobile-transactions.png)

Vérification supplémentaire : `python3 tests/transactions-ui.py` (Playwright/Chromium comme les autres parcours).
