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

`index.html` charge **une entrée de module** : `ui-entry.js?v=11.4.0`. Cette entrée importe les domaines puis les initialise dans l’ordre vérifié. Chaque fichier exporte `initialize(runtime)`; les anciens noms de version sont encore conservés pour identifier les domaines et garder les chemins compatibles.

Le noyau possède ses variables dans une fermeture. Les modules reçoivent des accesseurs explicites vers l’état et les points de rendu partagés. Le pont global, limité aux anciens noms déjà utilisés, préserve les hooks existants et les diagnostics. Il évite de changer les règles de rendu en même temps que le mécanisme de chargement. Il n’y a ni injection séquentielle de scripts classiques, ni `eval`, ni compilation au démarrage.

Les hooks `render` et `send` restent composés dans le même ordre. Cette couche de compatibilité est volontaire : la remplacer par un système d’événements indépendant serait une autre modification de comportement à tester séparément.

## CSS

`styles.css` est l’entrée. Les fichiers faisant autorité sont :

- `styles-foundation.css` : fondations et premières structures;
- `styles-domains.css` : composants et écrans par domaine;
- `styles-sillage.css` : présentation Sillage et ajustements existants;
- `styles-tokens.css` : palette et correspondance des variables de thème.

Les composants conservent leur ordre dans la couche `application`. Les variables du thème sont isolées dans la couche `tokens`. Répartir immédiatement chaque ancienne version dans une couche différente inverserait certaines priorités `!important`; cela modifierait l’apparence. La compatibilité est donc conservée et documentée. Les anciennes feuilles ne contiennent plus les règles : elles redirigent vers l’entrée actuelle. Modifier uniquement les fichiers faisant autorité.

Trois priorités redondantes ont été retirées et vérifiées; les autres ne sont pas déclarées inutiles. Leur retrait futur nécessite des comparaisons supplémentaires, notamment pour les styles intégrés utilisés par l’outil de contraste.

`refactor-parity-ui.py` compare 40 combinaisons de vue/thème/largeur au code v11.3 : propriétés CSS visibles identiques et données financières identiques. Les URL d’entrée, modules et styles portent une version; le serveur n’accepte ces variantes que pour sa liste fermée de fichiers publics.

## Installation et développement

Tous les modules nécessaires restent à la racine afin que le copieur Mac existant les installe. Le validateur de version et les tests de copie installée vérifient aussi les nouvelles ressources. Le dossier `data/` est exclu de la copie du code.

Il n’y a aucune dépendance externe à l’exécution. Un analyseur de syntaxe et un formateur ont servi ponctuellement pendant cette réorganisation, hors du dépôt; ils ne sont pas nécessaires sur le Mac pour lancer Sillage.
