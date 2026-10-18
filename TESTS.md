# Vérifications — Mon Budget 7.1

`npm test` : **159 tests réussis** (52 Node, 107 API), sans échec ni test ignoré, sur des bases temporaires.

Les tests supplémentaires couvrent l’aperçu sans écriture, le refus des choix invalides et des aperçus périmés, la réaffectation des factures et enveloppes datées, la suspension facultative des anciens virements, la préservation du registre réel et des rapprochements automatiques, l’annulation, le redémarrage, la sauvegarde/restauration et la remise à zéro. Ils vérifient aussi les virements personnels réels/prévus, les cartes sans réserve de remboursement automatique et le paiement Interac externe déduit une seule fois.

Parcours Chromium exécutés : `tests/budget-v71-ui.py`, `tests/budget-v70-ui.py`, `tests/transaction-transfers-ui.py`, `tests/budget-v61-ui.py`. La nouvelle configuration, ses choix de comptes, les virements conservés, le guide, le mode sombre et cinq largeurs sont vérifiés avec des données fictives.

L’installation native macOS et Safari sur le Mac de l’utilisateur restent à vérifier sur son appareil.

---

# Vérifications — Mon Budget 7.0

`npm test` : **152 tests réussis** (52 Node, 100 API), sans échec ni test ignoré. Données et serveurs temporaires exclusivement.

Les nouveaux tests vérifient le compte Conjoint unique et sa persistance, les virements liés sans double déduction, les réserves libérées une seule fois, l’association du réel, les suppressions et retraits de liens, les entrées en retard, la remise à zéro avec aperçu périmé, sauvegarde, restauration et redémarrage, ainsi que l’isolation de la démonstration. Les routes de démonstration restent derrière l’authentification privée existante.

Parcours Chromium v7 : `tests/budget-v70-ui.py`, `tests/transaction-transfers-ui.py`, `tests/planning-workflow-ui.py` et `tests/budget-v61-ui.py`. Les vérifications utilisent des données fictives et couvrent aussi le mode sombre et les largeurs mobiles.

L’installation native macOS et Safari sur le Mac de l’utilisateur ne sont pas exécutés depuis cet environnement Linux.

---

# Vérifications — Mon Budget 6.1

`npm test` : **141 tests réussis** (52 Node, 89 API), sans échec ni test ignoré. Node.js 24.19.0; données et serveurs temporaires exclusivement.

Les tests API ajoutés couvrent : objectifs mensuels et annulation, réserves restantes après dépenses, redémarrage et restauration, enveloppe existante liée à une récurrence sans double débit, refus des aperçus périmés et confirmation du négatif, six fréquences, nettoyage des liens, copie d’un mois sans effet financier, réservation future au premier jour, fusion des objectifs, réutilisation d’un identifiant supprimé et refus d’une réserve portant déjà le nom de la catégorie.

Les tests v6.1 couvrent les six fréquences, les vrais totaux 4/5 semaines et 2/3 quinzaines, le choix Non, les exceptions déjà saisies, la conservation de l’historique et des types de revenus, les dates anniversaires et bissextiles, le calendrier lors d’une modification future, les réserves hebdomadaires sans double déduction, la persistance et les renouvellements annuels après 400 jours. Les changements du choix Oui/Non invalident les aperçus signés précédents.

Parcours Chromium exécutés :

- `python3 tests/budget-v61-ui.py` : six choix de fréquence, réponse Oui/Non obligatoire, reconduction exacte après rechargement, montant par période dans l’éditeur, objectifs sans écriture financière, mode sombre et cinq largeurs.

- `python3 tests/budget-v60-ui.py` : nouveau Budget, réserves, réel, agenda distinct, classement et confirmation, reprise du mois, recherche, groupes, clair/sombre et cinq largeurs (375 à 1600 px).
- `python3 tests/planning-workflow-ui.py` : association du réel déjà saisi, achats partiels, corrections de revenus et virements, montants, reports, annulation, formulaire périmé, pont du solde et cinq largeurs.
- `python3 tests/categories-v52-ui.py` : répertoire compact, groupes, recherche, gestion, navigation sans écriture financière et cinq largeurs.
- `python3 tests/budget-v53-ui.py` : calcul exact sur cinq périodes, rapprochement bancaire, vérification et invalidation, confirmation unique et mode sombre/mobile.

Les raccourcis/macOS sont vérifiés par les tests Node existants, dont le contrôle des nouveaux fichiers requis dans un dossier de mise à jour. L’installation sur le Mac de l’utilisateur et l’exécution native dans Safari ne sont pas effectuées depuis cet environnement Linux.

---

# Historique des vérifications — Mon Budget 4.7

Les vérifications ci-dessous utilisent uniquement des données fictives et des bases temporaires, jamais les données de l’utilisateur. Environnement vérifié : Node.js 24.19.0, Python 3 et Chromium.

## Tests automatisés

`npm test` : **104 tests réussis**, aucun échec, aucun test ignoré.

| Suite | Nombre | Vérifications |
|---|---:|---|
| `tests/csv.test.js` | 5 | BOM, CSV multiligne, guillemets échappés, tabulations, CRLF, lignes vides, limites de taille, montants localisés, signes et refus des valeurs invalides |
| `tests/forecast.test.js` | 20 | Dates d’enveloppes, solde au 5 novembre, réserves, rapprochements, dépenses partielles, retards, cartes, exceptions et virements |
| `tests/private-access.test.js` | 6 | Configuration privée, identité propriétaire, port distinct, hôte et origine HTTPS |
| `tests/card-payments.test.js` | 13 | Achats datés, paiements fixes ou calculés, reports, remboursements marchands, rapprochement sans double débit, cartes multiples et réserve de crédit nulle |
| `tests/mac-service.test.js` | 6 | Lecture réelle du plist par plistlib, chemins avec espaces/caractères XML, paramètres de relance, refus hors macOS |
| `tests/api-tests.py` | 54 | Comptes/crédit, catégories, réserves plafonnées, bilan au-delà de 50 opérations, filtres/export complet, imports, corrections de soldes, objectifs, sauvegardes et migration |

La 4.7 ajoute trois tests API : validation des six blocs et des paramètres, sauvegarde indépendante téléphone/ordinateur, refus des modifications concurrentes sans écritures, conservation après redémarrage et restauration JSON, soldes et prévisions inchangés, maintien de l’annulation financière après une personnalisation et conservation des dispositions lors de cette annulation. Total : 50 tests Node et 54 tests API.

`python3 tests/dashboard-v47-ui.py` : glisser-déposer natif, ordre réel des éléments, largeur, masquage, rechargement, navigation, disposition mobile distincte, boutons Monter/Descendre, tous les blocs masqués puis retour aux valeurs par défaut, coupure réseau simulée et nouvelle tentative, conflit entre deux fenêtres avec les deux résolutions possibles. Largeurs 375/390/768/1024/1440, aucun débordement ni erreur JavaScript. La base est comparée avant/après (seuls les réglages de disposition changent); les prévisions sont identiques. Captures fictives.

Régressions exécutées en 4.7 : `tests/ui-smoke.py`, `tests/budget-v44-ui.py`, `tests/planning-ui.py` et `tests/mac-service-simulation.py`. La simulation de service vérifie la copie des nouveaux fichiers et les données conservées avec un faux launchctl. macOS, Safari iOS et Tailscale réels ne sont pas accessibles depuis cet environnement.

La 4.6 ajoute cinq tests API intégrés : sous-catégories homonymes dans des parents différents et doublons refusés; affectation, modification, rapport et filtre d’une transaction; archivage sans perte d’historique et refus des nouvelles affectations archivées; aperçu de fusion sans écritures, refus d’un jeton périmé, regroupement des enfants, addition des plafonds et annulation exacte; sauvegarde complète, contrôle de cohérence parent/enfant, import CSV avec valeur par défaut ou colonne et restauration d’un ancien JSON; migration réelle d’un schéma SQLite 4.5 avec copie cohérente préalable et préservation des identifiants et des soldes. Plusieurs de ces vérifications partagent un même test.

`python3 tests/categories-v46-ui.py` vérifie la création d’un enfant dans l’interface, la saisie et modification d’un achat, la suggestion du commerce et la priorité d’un choix manuel, le détail du bilan, l’archivage et la réactivation, le classement dans l’aperçu CSV, l’aperçu de fusion et son invalidation par un changement de formulaire, la réaffectation après confirmation, l’édition d’une ancienne transaction sous une catégorie archivée, les filtres et leur remise à zéro. Cinq largeurs (375/390/768/1024/1440), aucun débordement, aucune mutation lors de la consultation, aucune erreur JavaScript. Données fictives uniquement.

Régressions exécutées en 4.6 : `tests/categories-v45-ui.py`, `tests/transactions-ui.py`, `tests/workflows-ui.py`, `tests/budget-v41-ui.py`, `tests/transaction-transfers-ui.py`, `tests/budget-v44-ui.py` et `tests/mac-service-simulation.py`. La simulation macOS utilise un faux launchctl; aucun accès au Mac réel, à Safari iOS ou au compte Tailscale de l’utilisateur.

La 4.5 conserve les mêmes API et les mêmes calculs financiers. `python3 tests/categories-v45-ui.py` vérifie le nouvel onglet du menu principal, la création persistante, la disponibilité immédiate dans les cinq sélecteurs concernés, le refus des doublons accentués, la recherche sans accents, la recherche vide de résultats, le renommage d’une catégorie déjà utilisée et la conservation de la transaction et du solde. Il vérifie aussi les liens depuis Transactions/Bilan et la navigation mobile aux largeurs 375/390/768/1024/1440 : aucun débordement, aucune mutation en consultant les écrans, aucune erreur JavaScript. Données fictives uniquement.

Régressions exécutées pour cette version : `tests/workflows-ui.py`, `tests/planning-ui.py` et `tests/budget-v43-ui.py`. La suite de la 4.5 comptait 50 tests Node et 46 tests API, sans modification du schéma ou des règles de réserve.

La 4.4 ajoute quatre tests API intégrés :

- Configuration groupée : aperçu sans écritures, modes appliqués atomiquement, comptes/transactions/réserves inchangés et annulation exacte.
- Validation : liste vide, doublons, identifiants et modes invalides, nouvelle date rétroactive, aperçu périmé après un autre achat, confirmation d’un minimum négatif.
- Conversion libre : refus des récurrences régulières actives, signalement des paiements distincts, conservation de l’identifiant, de la réserve et des transactions, sauvegarde toujours compatible.
- Fiches/alertes : dépenses du mois et de la période, historique ancien, achats sans enveloppe, budget exceptionnel actif, premier risque avant la paie, solde actuel négatif non masqué par un revenu encore prévu, lecture sans écritures, prochain renouvellement réellement futur après celui d’aujourd’hui.

`python3 tests/budget-v44-ui.py` : fiches et historique complet, sélection de plusieurs enveloppes, invalidation d’un aperçu après modification du formulaire, confirmation protégée et rejet d’un changement concurrent, conversion vers Budgets libres avec conservation des montants, fiche accessible après recherche, suggestion de commerce à accepter explicitement et respect d’un choix manuel, détail du Safe-to-Spend au clavier, alertes, confirmation négative et cinq largeurs (375/390/768/1024/1440). Aucun débordement, aucune mutation en consultant les écrans, aucune erreur JavaScript. Données entièrement fictives.

Régressions exécutées en 4.4 : `tests/free-budgets-ui.py`, `tests/budget-v43-ui.py`, `tests/budget-v41-ui.py`, `tests/transactions-ui.py`, `tests/planning-ui.py`, `tests/ui-smoke.py` et `tests/mac-service-simulation.py`. La simulation de service teste l’installation, la copie des nouveaux fichiers et la conservation des données avec un faux launchctl; elle ne remplace pas une vérification de Safari/iOS, macOS ou Tailscale réels.

La 4.3 ajoute trois tests API : renommage d’une catégorie avec conservation des transactions/plafonds et annulation exacte; refus atomique des doublons, identifiants invalides et formulaires périmés; budget mensuel réservé, sans paiement automatique, achat réel consommant la réserve une seule fois, renouvellement sans report, dépassement et redémarrage idempotent.

`python3 tests/budget-v43-ui.py` vérifie le badge v4.3, l’accès aux catégories depuis Transactions, le nom dans l’historique, le raccourci mensuel proposé au premier du mois suivant, les réserves actuelles et futures, les deux modes de prévision, et l’achat partiel à Safe-to-Spend constant. Largeurs 375/390/768/1024/1440, aucun débordement, aucune mutation en consultant les écrans et aucune erreur JavaScript. Captures avec données fictives.

Parcours de régression exécutés pour la 4.3 : `tests/free-budgets-ui.py`, `tests/budget-v41-ui.py`, `tests/transactions-ui.py` et `tests/planning-ui.py`. Les scénarios macOS/Tailscale restent soumis aux limites d’environnement décrites plus bas; aucun accès au Mac de l’utilisateur.

Les tests API vérifient notamment :

- Dépense sur crédit et signes des soldes, modification et suppression d’une dépense plafonnée sans créer de réserve supplémentaire.
- Classement d’une ancienne transaction sans modifier les réserves ni les soldes.
- Totaux mensuels sur l’ensemble des opérations; exclusion des virements et ajustements de solde; filtres de catégorie et de compte.
- Export au-delà de la pagination et neutralisation des descriptions interprétables comme formules de tableur.
- Import de dates jour/mois et de descriptions multilignes, montants localisés et débit/crédit séparés.
- Import historique sans effet sur le solde, puis modification et suppression sans effet sur ce solde.
- Doublons possibles, autorisation explicite des doublons, revérification à la confirmation, rejet d’une sélection invalide sans import partiel et rejet d’options différentes de l’aperçu.
- Correction de solde avec historique; refus si le compte a changé depuis la comparaison; objectifs sans modification du disponible.
- Validation et restauration d’un export complet; refus des tables manquantes, dates invalides, liens absents, clés dupliquées et montants invalides sans modifier le budget courant.
- Copie de sécurité avant restauration et persistance après redémarrage.
- Migration additive d’une ancienne base, conservation des identifiants et montants, copie SQLite avant ajouts v3 et démarrage répété sans catégories en double.
- Refus des mutations provenant d’une origine externe, d’un type de contenu non JSON ou d’un hôte externe.

## Parcours navigateur

`python3 tests/ui-smoke.py` : **réussi**.

- 30 points et 30 lignes de prévision, navigation clavier Début/Fin et avertissement sous zéro.
- Budget nul constant, états vides, raccourcis et dialogues.
- 13 écrans à 390 et 1440 pixels; tableau de bord également vérifié à 375, 768 et 1024 pixels, sans débordement de page.
- Préférences système sombre et réduction des animations.
- Erreur de validation API visible dans la fenêtre, puis enregistrement valide avec confirmation, fermeture et variation exacte du compte sélectionné.

`python3 tests/workflows-ui.py` : **réussi**.

- Dépense saisie comme montant positif puis modification en revenu, avec vérification des soldes réels par API.
- Bilan mensuel, création de catégorie et plafond mensuel.
- Création/modification d’un objectif.
- Téléversement CSV, correspondance des colonnes, aperçu avec doublon désélectionné et import historique sans modification des soldes.
- Comparaison puis correction confirmée du solde et affichage dans l’historique.
- Téléchargement d’une sauvegarde, téléversement, confirmation textuelle, restauration complète et refus d’un fichier invalide sans modification du budget.
- 13 écrans avec données à 390 et 1440 pixels; aucune erreur JavaScript ou console inattendue.

Les réponses HTTP 400 des saisies et sauvegardes volontairement invalides sont attendues et distinguées des erreurs inattendues.

## Instance et contrôles supplémentaires

- Syntaxe de `server.js`, `budget-features.js`, `app.js` et `features.js` : réussie.
- Syntaxe Bash de `Lancer Mon Budget.command` : réussie.
- Instance principale redémarrée en v3; réponse API vérifiée avec 90 jours de prévision et 10 catégories initiales.
- Captures de `docs/` : données fictives exclusivement.

## Limites

Safari réel, Finder/macOS, les permissions/quarantaine du lanceur et les données personnelles de l’utilisateur restent à vérifier sur Mac. Le lanceur `.command` n’est pas une application Mac autonome signée.

Les tests ne couvrent pas tous les historiques possibles, toutes les migrations très anciennes, les conventions de tous les relevés bancaires, les combinaisons de jours fériés et de récurrences ou les très grandes bases. Les contrôles des calculs existants ne constituent pas une nouvelle certification exhaustive du moteur financier. Vérifiez vos soldes et vos enveloppes sur une copie avant utilisation quotidienne.


## Comptes et Planifier — vérifications de la nouvelle interface

`python3 tests/planning-ui.py` : **réussi dans Chromium**, avec des comptes, enveloppes, objectifs et récurrences fictifs.

- Neuf entrées visibles dans le menu principal, treize écrans accessibles; onglets de Planifier et menu mobile dépliant.
- Cartes de comptes, éditeurs et comparaison de solde à la demande; interrupteur d’inclusion vérifié contre l’API.
- Cartes d’enveloppes, éditeur et outil exceptionnel fermé par défaut.
- Cartes et filtres de récurrences; rapprochement manuel fermé par défaut.
- Horizons 30/60/90 jours; minimum et détails égaux aux montants fournis par le serveur.
- Curseur clavier Début/Fin, changement de date, navigation de semaines et sélection d’une journée; dernière semaine partielle.
- Liste détaillée de 90 jours conservée dans un volet; développement des 90 journées vérifié.
- Avertissement négatif et accès au creux prévu.
- Calendrier mensuel, jours avec mouvements et détail d’une journée.
- Comptes, prévision, enveloppes, récurrences, objectifs et calendrier vérifiés à 375, 390, 768, 1024 et 1440 pixels, sans débordement de page.
- Comparaison de toutes les tables avant et après la navigation : aucun changement des données financières par l’exploration de ces vues.
- Aucune erreur JavaScript ou console inattendue. Les autres parcours navigateur et la suite automatisée reste réussie.

Les captures de ces vues dans `docs/` sont fictives. Safari réel reste à vérifier sur Mac.


## Transactions — historique et saisie simplifiés

La couverture API de l’historique vérifie les totaux sur toutes les pages, les filtres, les descriptions récentes avec catégories et la recherche sans accents avec `%`, `_` et `\` traités littéralement.

`python3 tests/transactions-ui.py` : **réussi dans Chromium**, sur une base temporaire.

- Totaux identiques sur les différentes pages et recalculés sur l’ensemble des résultats filtrés.
- Recherche accentuée; une réponse ancienne volontairement retardée ne remplace pas une recherche plus récente.
- Marquage d’une opération comme révisée, filtres rapides, catégories et périodes.
- Historique et éditeur vérifiés à 375, 390, 768, 1024 et 1440 pixels sans débordement horizontal.
- Proposition de catégorie depuis un commerce récent; choix manuel préservé et catégorie effacée lors d’un changement Dépense/Revenu.
- Enregistrement en continu : fenêtre conservée, montant/description effacés après succès, puis deuxième opération enregistrée; soldes exacts vérifiés par API.
- Copie d’opération préparée à la date du jour sans création à la fermeture du brouillon; saisie d’un revenu et signe du solde vérifiés.
- Suppression de la dernière opération d’une page : retour automatique à la page précédente.
- Réponse HTTP 503 volontaire : totaux retirés, nouvelle tentative fonctionnelle. Cette erreur attendue est distinguée des erreurs inattendues.

Les autres parcours navigateur restent réussis. Les captures publiées utilisent uniquement des données fictives. Safari réel reste à vérifier sur Mac.

## Prévision complète et suivi réel (3.1)

`npm test` : **32 tests réussis** (5 CSV, 14 moteur financier et 13 API).

- Exemple déterministe : 2 000 $ en banque, enveloppe de 230 $ les jeudis 22 et 29 octobre et 5 novembre 2026 → 1 310 $ de solde projeté au 5 novembre, sans double déduction des réserves.
- Transaction réelle de 215 $ remplaçant 230 $; écart de −15 $, conservation de la réserve réelle inutilisée, réouverture d’une période partielle et agrégation de plusieurs achats.
- Combinaison de toutes les enveloppes, revenus, factures et virements; compte manquant signalé avec déduction du total; enveloppe non planifiée et mode réserve seulement.
- Dépense liée prioritaire pour sa période; une règle ponctuelle ne supprime pas les futures périodes d’enveloppe.
- Dépenses en retard encore déduites; revenus en retard non utilisés avant confirmation.
- Rapprochement automatique unique, cas ambigus non rapprochés, association manuelle d’un montant différent et rétablissement après suppression du réel.
- Aucune réserve de remboursement des cartes : dette et achat sans déduction automatique du disponible; seuls les virements de remboursement prévus ou réels réduisent le solde et le disponible.
- Exceptions de budget, report des réserves, annulations et déplacements ciblés.
- Migration additive, copie SQLite préalable, export/restauration des nouveaux suivis et compatibilité des exports JSON v3 antérieurs.

`python3 tests/forecast-ui.py` : **réussi dans Chromium**, avec données fictives et base temporaire.

- Dépenses d’enveloppes visibles au calendrier; solde projeté à la date choisie égal à l’API; choix de courbe Solde/Disponible.
- Onglet Prévu / Réel, filtres et avertissements, champs de configuration d’enveloppe.
- Brouillon de transaction sans enregistrement implicite; achat réel de 215 $ remplaçant 230 $, achats supplémentaires puis fin de période.
- Association d’une facture réelle de 115 $ à une prévision de 120 $.
- Prévision, suivi, calendrier et enveloppes à 375, 390, 768, 1024 et 1440 pixels, sans débordement.
- Navigation sans mutation des tables financières et aucune erreur JavaScript ou console inattendue.

Les quatre autres parcours navigateur restent réussis. Le suivi commence à l’activation; les prévisions historiques antérieures ne sont pas reconstituées. Les calculs utilisent les règles actuelles, sans journal immuable des anciennes versions de règles. Les rapprochements ambigus et opérations futures déjà saisies comme réelles exigent une vérification. Safari et les données réelles de l’utilisateur restent à vérifier sur Mac.

## À confirmer et explication du solde (3.2)

`npm test` : **44 tests réussis** (5 CSV, 20 moteur et 19 API), sans échec ni test ignoré.

- Confirmation atomique de revenus, dépenses et virements avec un montant différent; détection des doubles validations et des fiches obsolètes; rejet des dates réelles futures sans mutation financière.
- Association d’un réel existant sans réappliquer le solde; affectation et retrait d’enveloppe conservant les montants réellement réservés.
- Enveloppe confirmée en retard rattachée à sa période d’origine; absence de double comptage dans la période actuelle; suppression rétablissant la prévision.
- Report et modification d’une seule occurrence, enveloppes et récurrences; annulation sans opération bancaire; identité d’origine conservée.
- Achats automatiques d’enveloppes rapprochés selon les dates déplacées; dates identiques ambiguës laissées à associer explicitement.
- Pour chacune des 90 dates : solde réel de départ + impacts classés = solde bancaire projeté, puis moins les réserves = disponible projeté.
- Virements internes et réservations sans impact bancaire; dette de carte exclue des réserves, remboursement pris en compte et remboursement marchand sur crédit réduisant la dette.
- Conservation et restauration des nouvelles associations; compatibilité des exports antérieurs; rejet d’un export actuel auquel manque une nouvelle table.

`python3 tests/planning-workflow-ui.py` : **réussi dans Chromium**, avec données fictives dans une base temporaire.

- Liste quotidienne, filtres, historique, association d’une dépense déjà saisie sans débit supplémentaire.
- Deux achats d’enveloppe de 100 $ puis 115 $ remplaçant un budget de 230 $; montant restant correctement affiché puis fermeture de la période.
- Paie et virement confirmés avec des montants corrigés; vérification des soldes exacts par API; aucune réserve automatique pour la carte.
- Report, modification d’une occurrence et annulation sans changement des soldes réels.
- Formulaire périmé : erreur visible dans la fenêtre, sans nouvelle opération.
- Explication et groupes de mouvements conformes à la simulation pour la date choisie; mise à jour au clavier Début/Fin.
- Liste, prévision et fenêtre de confirmation à 375, 390, 768, 1024 et 1440 pixels sans débordement; exploration sans modification des tables financières.

Les cinq autres parcours navigateur ont également réussi. Une erreur HTTP 400 du formulaire obsolète est attendue et distinguée des erreurs inattendues. Les captures publiées sont fictives. Safari et l’historique réel de l’utilisateur restent à vérifier sur son Mac.

## Accès privé Mac/iPhone (3.3)

`npm test` : **70 tests réussis** (5 CSV, 20 moteur, 6 accès privé et 20 API).

- Accès privé désactivé sans configuration; configuration invalide refusée au démarrage.
- Port privé distinct, adresse HTTPS Tailscale et propriétaire explicite.
- Requêtes sans identité, autre utilisateur et en-tête d’identité de remplacement refusés, même si le proxy réécrit Host vers la boucle locale.
- Écritures privées exigeant l’identité, l’origine HTTPS exacte et le type JSON; requêtes refusées sans mutation des tables.
- Test HTTP sur les deux ports : données lues et modifiées avec l’identité simulée du propriétaire, accès local toujours fonctionnel et hôte distant refusé sur le port local.
- Les en-têtes Tailscale sont simulés dans ces tests de backend : ce n’est pas une vérification du tunnel Tailscale réel ni de son authentification réseau.
- Syntaxe Bash du nouveau lanceur vérifiée. Le lanceur refuse de remplacer d’autres services Serve ou un Funnel existant.

Tailscale Serve, la commande macOS `open`, la gestion de veille, les permissions macOS et Safari/iPhone restent à vérifier sur les appareils de l’utilisateur. La consultation de la documentation Tailscale depuis l’environnement a été refusée (HTTP 403); aucune validation en direct de la version installée de Tailscale n’est revendiquée. Le guide fournit les étapes d’activation à effectuer sur les appareils.

## Remboursements de cartes — v3.4

`python3 tests/card-payments-ui.py` : parcours sur données fictives, réutilisation d’une règle existante, achat CIBC et paiement Conjoint distincts au calendrier, rapprochement d’un paiement réel de 215 $ sans nouveau débit, montant fixe, pause/reprise et cinq largeurs d’écran. Les six autres parcours navigateur ont aussi été exécutés avec succès.

Les tests API refusent un nouveau paiement implicite lorsqu’un virement réel proche reste à associer et vérifient que le refus ne modifie aucune table. Les tests couvrent aussi la sauvegarde/restauration du plan et la consultation sans écriture financière. L’intégration réelle Finder/Safari/Tailscale sur Mac et iPhone reste à vérifier sur les appareils de l’utilisateur.

## Fréquences étendues — v3.5

Le test API des factures vérifie les six fréquences, les fins de mois et années bissextiles, le refus d’exceptions hors échéance, les occurrences trimestrielles/semestrielles/annuelles dans la prévision, la sauvegarde/restauration et la migration de l’ancienne contrainte SQLite en conservant les règles et leurs liens. Le parcours `tests/planning-ui.py` vérifie l’interface des récurrences et les vues de prévision.

## Saisie des virements — v3.6

`python3 tests/transaction-transfers-ui.py` : réussi. Vérification du choix Virement dans la fenêtre Transactions, refus des comptes identiques, soldes banque/carte après un virement réel, absence de revenu/dépense et de réserve de crédit, virement unique prévu puis confirmé sans double débit, sept choix de répétition, règle trimestrielle, enregistrement avec poursuite de saisie, dernières opérations, retour au mode Dépense, erreur serveur visible sans écriture et cinq largeurs d’écran. Le parcours existant `tests/transactions-ui.py` a aussi réussi; `npm test` conserve ses 70 tests réussis.

## Service macOS — v3.7

`python3 tests/mac-service-simulation.py` : réussi, avec un vrai serveur Node et une vraie base SQLite temporaires, mais un **launchctl simulé**. Vérifie première installation, copie des données vers le dossier fixe, serveur détaché, nouvelle installation pendant son exécution, préservation de la base active même sans base dans le dossier téléchargé, sauvegardes SQLite, arrêt/désactivation sans suppression des données et refus d’arrêter un serveur manuel indépendant.

`bash -n` réussit sur les quatre lanceurs `.command`. `npm test` : 46 tests Node + 26 tests API réussis. L’agent macOS réel, sa relance après ouverture de session, Finder, la veille et Tailscale/Safari restent à vérifier sur les appareils de l’utilisateur. Aucun service du Mac de l’utilisateur n’a été installé à distance.

## Refonte 4.0

`npm test` : **46 tests Node + 27 tests API réussis**. La simulation compare sa base aux prévisions réellement retournées par l’application. Elle vérifie un achat sur compte inclus, un achat sur carte répercuté sur son prochain paiement, un achat sur compte exclu (solde propre négatif sans changement global), le déplacement d’une dépense d’enveloppe, les entrées invalides et l’absence totale d’écriture dans les tables exportées.

`python3 tests/planning-v4-ui.py` : réussi. Vérifie les horizons 30/60/90 jours, les montants exacts du serveur, le choix de courbe, la sélection au clavier/date, la simulation sur carte et sa seconde courbe, le calendrier mois/semaine et son clavier, le passé réel sans solde inventé, l’ajout préparé à une date sans enregistrement, le déplacement prévisualisé puis appliqué via le formulaire existant, l’accès à la confirmation, le résumé d’une dépense rapprochée (120 $ prévus contre 115 $ réels), les alertes négatives et le budget vide. Vérification des deux écrans et du simulateur aux largeurs 375, 390, 768, 1024 et 1440 px; aucun débordement de page, aucune erreur JavaScript, aucune écriture financière lors de la consultation.

Les parcours `ui-smoke.py`, `workflows-ui.py`, `transactions-ui.py`, `transaction-transfers-ui.py`, `planning-ui.py`, `forecast-ui.py`, `planning-workflow-ui.py` et `card-payments-ui.py` ont réussi. Les quatre derniers ouvrent explicitement les outils d’audit conservés pour vérifier leurs anciens parcours; le test 4.0 vérifie les nouvelles vues par défaut.

`mac-service-simulation.py` a réussi après le changement de version : l’installateur copie aussi les nouveaux fichiers JavaScript et CSS dans le dossier fixe et conserve la base. L’installation macOS/Tailscale réelle et Safari sur iPhone restent à vérifier sur les appareils de l’utilisateur. Les captures de démonstration contiennent uniquement des données fictives.

## Ouverture et mise à jour macOS — v4.0.1

`npm test` : 50 tests Node + 27 tests API réussis. Les nouveaux tests exécutent les raccourcis générés avec Bash dans des chemins contenant espaces et apostrophes, vérifient que les arguments sont transmis littéralement et que les dossiers incomplets, les autres applications et les versions anciennes sont refusés avant exécution. Le validateur ne prétend pas vérifier une signature d’authenticité.

`mac-service-simulation.py` vérifie aussi la création des trois raccourcis permanents avec permissions 0700, l’ouverture d’un service existant sans deuxième serveur et la conservation de la base après mise à jour. Aucun changement global Gatekeeper ni aucune suppression de quarantaine n’est effectué. Finder, osascript et Gatekeeper réels ne sont pas disponibles dans cet environnement Linux; leur comportement reste à vérifier sur le Mac.

## Fiabilité et version visible — 4.1

`npm test` : **50 tests Node + 33 tests API**, aucun échec. Les six nouveaux tests API couvrent l’annulation d’une dépense avec restauration exacte de la réserve et des soldes, l’utilisation unique de cette annulation, le refus d’un ancien jeton après une autre écriture, les profils/scénarios persistants et sauvegardables, les configurations invalides, les 30 dates de sauvegarde, le téléchargement sécurisé par date, le maintien des autres fichiers, le rapprochement de carte sans écriture et la recherche avec accents hors pagination.

`python3 tests/budget-v41-ui.py` : réussi. Vérifie le badge réel v4.1, la recherche puis l’ouverture d’un éditeur sans sauvegarde, la comparaison bancaire sans écriture puis la correction explicitement notée et son annulation, le profil CSV mémorisé et reconnu au rechargement (colonnes, compte, signe, retour au mode historique), l’aperçu de l’import, la copie quotidienne téléchargeable, le scénario enregistré/repris sans opération réelle, le prochain revenu, le filtre partagé et le solde propre d’une carte, le saut de mois. Recherche, rapprochement et cinq écrans testés à 375/390/768/1024/1440 px, sans débordement ni erreur JavaScript. Les changements de saisie invalident les comparaisons devenues obsolètes.

Les parcours navigateur existants et le cycle du service Mac simulé sont conservés. Les tests utilisent uniquement des données fictives et des bases temporaires. L’exécution effective des raccourcis Finder, du service macOS et de Safari/iPhone reste à vérifier sur les appareils de l’utilisateur.

## Budgets libres — 4.2

`npm test` : **50 tests Node + 39 tests API**, aucun échec. Les six nouveaux cas API vérifient la reprise automatique sans écriture d’une enveloppe de réserve, les neuf suggestions répétables sans doublon, la conservation des identifiants et achats, l’alimentation et la libération sans transaction/virement, le refus d’un aperçu périmé, l’annulation exacte d’une allocation, le minimum projeté et l’acquittement requis avant une réservation négative, les achats banque/carte et la réserve de crédit nulle, l’achat ponctuel prévu sans double déduction, la mise en pause, la suppression sans historique avec restitution de réserve, le refus de reprise programmée et la sauvegarde/restauration sans nouveau format.

`python3 tests/free-budgets-ui.py` : réussi. Parcours du sous-onglet et du badge v4.2, réutilisation d’une ancienne Maison avec achats, séparation des enveloppes régulières, neuf suggestions sans répétition ni changement d’une ancienne Outils, reprise explicite de cette Outils, aperçu sans écriture, réservation, achat réel sur la bonne enveloppe sans deuxième baisse du disponible libre, libération, refus après changement depuis l’autre appareil, acquittement négatif, création à zéro, pause/réactivation et suppression d’un budget vide. La recherche tolère les accents. Les cinq vues et les formulaires d’aperçu sont vérifiés à 375/390/768/1024/1440 px, sans débordement ni erreur JavaScript, et la consultation ne change pas les tables financières.

Les parcours 4.0/4.1, enveloppes, prévisions, cartes, import/restauration et le cycle du service Mac simulé restent validés. Les captures ne contiennent que des données fictives. L’intégration Finder/Tailscale et Safari/iPhone réelle reste à vérifier sur les appareils de l’utilisateur.
