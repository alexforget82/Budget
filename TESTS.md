# Vérifications — Mon Budget 3

Les vérifications ci-dessous utilisent uniquement des données fictives et des bases temporaires, jamais les données de l’utilisateur. Environnement vérifié : Node.js 24.19.0, Python 3 et Chromium.

## Tests automatisés

`npm test` : **32 tests réussis**, aucun échec, aucun test ignoré.

| Suite | Nombre | Vérifications |
|---|---:|---|
| `tests/csv.test.js` | 5 | BOM, CSV multiligne, guillemets échappés, tabulations, CRLF, lignes vides, limites de taille, montants localisés, signes et refus des valeurs invalides |
| `tests/forecast.test.js` | 14 | Dates d’enveloppes, solde au 5 novembre, réserves, rapprochements, dépenses partielles, retards, cartes, exceptions et virements |
| `tests/api-tests.py` | 13 | Comptes/crédit, catégories, réserves plafonnées, bilan au-delà de 50 opérations, filtres/export complet, imports, corrections de soldes, objectifs, sauvegardes et migration |

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
- Réserves de remboursement des cartes; achat sans sortie bancaire immédiate, puis virement réduisant le solde sans double déduction du disponible.
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
