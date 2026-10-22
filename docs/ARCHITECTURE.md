# Architecture — étapes 2 et 3

## Serveur

`server.js` assemble l’application : services financiers, prévisions canoniques, orchestration des requêtes et démarrage des deux écouteurs loopback.

| Module | Responsabilité |
| --- | --- |
| `database.js` | Ouverture SQLite, migration, WAL, requêtes et transaction atomique |
| `database-migrations.js`, `database-migration-001.js` | Migrations numérotées et sauvegardes cohérentes |
| `recurrence-calendar.js` | Calcul existant des dates, jours ouvrables et jours fériés |
| `routes-accounts.js`, `routes-transactions.js`, `routes-transfers.js` | Validations et mutations par domaine |
| `routes-envelopes.js`, `routes-recurrences.js`, `routes-planning.js` | Programmation, enveloppes et rapprochements |
| `routes-read.js` | Réponses de consultation, exportations et état |
| `chatgpt-export.js` | Instantané financier à champs explicites pour partage manuel dans ChatGPT, sans API externe |
| `http-body.js`, `http-security.js`, `http-assets.js` | JSON borné, hôte/origine, en-têtes et liste fermée des ressources |
| `forecast-engine.js`, `card-envelope-funds.js`, `global-budget.js`, `budget-calendar.js` | Calculs financiers existants, séparés du transport HTTP |

Les fonctions de route reçoivent leurs services explicitement. Une route qui répond à une validation erronée termine la réponse avant le traitement commun; une mutation réussie conserve l’application du périmètre bancaire et l’instantané final. Les transactions et protections de double rapprochement sont conservées.

La séparation ne réécrit pas les formules financières : la comparaison contre le vrai code v11.3 inclut les soldes, enveloppes, transactions, rapprochements et 90 jours de prévision.

## Interface native ES

`index.html` charge **une entrée de module** : `ui-entry.js?v=14.4.0`. Cette entrée importe les domaines puis les initialise dans l’ordre vérifié. Chaque fichier exporte `initialize(runtime)`; les anciens noms de version sont encore conservés pour identifier les domaines et garder les chemins compatibles.

Le noyau possède ses variables dans une fermeture. Les modules reçoivent des accesseurs explicites vers l’état et les points de rendu partagés. Le pont global, limité aux anciens noms déjà utilisés, préserve les hooks existants et les diagnostics. Il évite de changer les règles de rendu en même temps que le mécanisme de chargement. Il n’y a ni injection séquentielle de scripts classiques, ni `eval`, ni compilation au démarrage.

Les hooks `render` et `send` restent composés dans le même ordre. Cette couche de compatibilité est volontaire : la remplacer par un système d’événements indépendant serait une autre modification de comportement à tester séparément.

## CSS

`styles.css` est l’entrée. Les fichiers faisant autorité sont :

- `styles-foundation.css` : fondations et premières structures;
- `styles-domains.css` : composants et écrans par domaine;
- `styles-sillage.css` : présentation Sillage, téléphone, navigation, formulaires et zones de sécurité;
- `styles-tokens.css` : palette et correspondance des variables de thème.

Les composants conservent leur ordre dans la couche `application`. Les variables du thème sont isolées dans la couche `tokens`. Répartir immédiatement chaque ancienne version dans une couche différente inverserait certaines priorités `!important`; cela modifierait l’apparence. La compatibilité est donc conservée et documentée. Les anciennes feuilles ne contiennent plus les règles : elles redirigent vers l’entrée actuelle. Modifier uniquement ces quatre fichiers faisant autorité; ne pas créer de nouvelle feuille par numéro de version. `styles-mobile.css`, `styles-v13.css` et `styles-v14.css` sont désormais des redirections de compatibilité. Les importations actives sont toutes déclarées dans `styles.css`.

La consolidation v14.1 retire 51 règles identiques et 63 définitions globales de palette remplacées par les variables de `styles-tokens.css`. Avant les retouches du tableau de bord, une comparaison de 27 propriétés par élément donne zéro écart sur 36 vues et 11 516 éléments visibles (deux thèmes, deux largeurs et neuf écrans). Les variables locales de composants et l’ordre de cascade sont conservés. [Relevé](v141/css-consolidation.json).

Trois priorités redondantes avaient été retirées et vérifiées lors de la première séparation; les autres ne sont pas déclarées inutiles. Leur retrait futur nécessite des comparaisons supplémentaires, notamment pour les styles intégrés utilisés par l’outil de contraste.

`refactor-parity-ui.py` compare 20 combinaisons de vue/thème sur ordinateur au code v11.3 : propriétés CSS visibles identiques et données financières identiques. Le panneau de vérification ajouté en v11.6 est exclu de cette comparaison historique et possède son propre parcours `confidence-v116-ui.py`. Depuis la v11.5, le téléphone est volontairement remanié et vérifié séparément par `mobile-v115-ui.py`. `mobile-ui.js` déplace les contrôles existants dans des sections repliables et restaure leurs positions sur ordinateur; il ne modifie aucun calcul. Les URL d’entrée, modules et styles portent une version; le serveur n’accepte ces variantes que pour sa liste fermée de fichiers publics.

## Installation et développement

Tous les modules nécessaires restent à la racine afin que le copieur Mac existant les installe. Le validateur de version et les tests de copie installée vérifient aussi les nouvelles ressources. Le dossier `data/` est exclu de la copie du code.

Il n’y a aucune dépendance externe à l’exécution. Un analyseur de syntaxe et un formateur ont servi ponctuellement pendant cette réorganisation, hors du dépôt; ils ne sont pas nécessaires sur le Mac pour lancer Sillage.

## Protections de carte v12

`card-envelope-funds.js` utilise le même ensemble de lots pour les achats d’enveloppes et les achats récurrents identifiés sans enveloppe. Les remboursements consomment les lots de la carte concernée. `card_envelope_reserved_cents` et `sts_breakdown.card_envelopes` conservent leur nom de compatibilité mais comprennent également les lots avec `protection_kind: recurring` et `envelope_id: null`. Les consommateurs du disponible utilisent `forecastInput()` complet; le suivi d’enveloppes reprend le total initial de la même simulation. La dette générale reste exclue et `credit_reserved_cents` reste nul.

Une date d’activation et les identités de transactions protégées à conserver sont stockées dans `app_settings`. Pas de changement du schéma SQLite. Une identité complète évite de protéger par erreur un nouvel achat ayant réutilisé un identifiant supprimé. Avant modification/suppression d’une récurrence, les achats déjà reconnus sont conservés; les associations d’occurrences reconnues restent stables pour les modifications de tarif. Les modifications de transactions actualisent ou retirent leurs identités dans la même transaction SQLite. Les sauvegardes valident ces métadonnées.

La vérification de version est une route propriétaire GET `/api/release/check`, avec URL publique fixe, délai de cinq secondes et réponse limitée à 8 Ko. Elle n’utilise ni cookie, ni identité Tailscale, ni données financières. Le téléchargement proposé est un ZIP GitHub à tag de version valide; l’installation conserve le parcours Mac existant.

## Validation monétaire v14.1

`money.js` valide les montants numériques entrants avant conversion en centimes. Une fraction de cent est refusée, y compris en notation scientifique; les calculs internes continuent d’utiliser des entiers. Le validateur du dossier de mise à jour exige ce module. L’import CSV possède déjà sa validation de précision et conserve son traitement des séparateurs bancaires.

La modification financière d’une transaction utilise maintenant le maximum de la couverture de Bien démarrer et de celle du compte alloué, comme à la création. La transaction modifiée est exclue de la recherche de reçu; les autres reçus restent pris en compte. Les simples changements de libellé conservaient déjà leur effet d’enveloppe et le conservent encore.

## Confiance v14.3

`forecast-history.js` observe les états canoniques remis au propriétaire et conserve un journal privé dans `data/forecast-history.json`, écrit par remplacement atomique avec permissions privées. Une observation identique ne crée rien; une préférence d’apparence ou une coche de révision ne crée pas de variation. La dernière empreinte d’entrées et les 90 jours canoniques servent à la comparaison; seules 40 observations de variation sont conservées. Les identités composites des périodes et associations restent distinctes.

À chaque horizon, la différence des minimums est exacte. Si le nouveau point bas existait dans l’ancienne fenêtre, la différence se décompose en changement du solde à cette date, changement des réserves et différence entre l’ancien point bas et cette date. Le point d’ouverture est distingué de la fin de journée. Si la date entre dans l’horizon, seule la différence globale est annoncée, sans inventer une comparaison antérieure. Les entrées modifiées d’un lot sont listées sans leur attribuer individuellement une portion du total.

Le journal est indépendant du SQLite, de l’annulation financière et des exports de sauvegarde. Une restauration ou un effacement complet le réinitialise. Une panne du journal ne fait pas échouer une opération financière; son indisponibilité est affichée. Le fichier n’est pas une ressource HTTP et son contenu n’est pas ajouté à la vue partagée.

`reconciliation-hints.js` est une fonction pure de suggestion : échéances dues et paires de transactions dans le compte vérifié, avec direction inversée pour le solde dû d’une carte. Les propositions sont limitées et les limites de l’échantillon sont indiquées. Les mutations restent dans les traitements existants.

`budget-confidence.js` présente le journal et les résumés de période issus des insights existants. Les styles sont ajoutés à `styles-sillage.css`, sans nouvelle feuille par version. Le validateur de mise à jour et les tests de copie installée exigent les trois nouveaux modules.

## Registre v14.4

`transaction-register.js` décore les lignes du registre existant et déplace les contrôles d’origine, sans copier leurs mutations. Les colonnes d’en-tête et de lignes utilisent la même variable CSS; la présentation passe à deux lignes sous 1100 pixels. Les dates, cases, menus et commandes de révision restent les éléments d’origine. Le statut d’association est lu dans les lignes de prévision et les liens existants.

Le classement rapide appelle `bulk-preview` puis `bulk-apply` pour un seul identifiant, avec le jeton produit par le serveur. Les changements contiennent uniquement les champs réellement modifiés. Une catégorie seule ne réécrit pas l’enveloppe; celle-ci nécessite un aperçu et une confirmation. Une modification du formulaire supprime son aperçu, les champs sont bloqués pendant une requête et les données périmées sont refusées par le traitement existant. Le rendu final actualise l’état et la liste sans remettre systématiquement la pagination à un.

Le paramètre de filtre Enveloppe était déjà pris en charge par l’API; la saisie du filtre est ajoutée à la requête et à l’export existants. Le tri par nom d’enveloppe utilise une entrée fixe de la liste SQL autorisée. Les finances ne sont ni recalculées par le navigateur ni modifiées par un filtre ou un tri. Le module fait partie des ressources fermées et des fichiers exigés par le validateur d’installation.
