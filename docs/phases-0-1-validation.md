# Étapes 0 et 1 — relevé de validation

Livraison : **v11.2.0**, uniquement sécurisation technique et retour à la v11.1. Aucun changement intentionnel des fonctions, calculs ou styles. Pas de découpage des routes, de conversion ES des scripts, de réorganisation CSS ni d’audit complet de sécurité (phases suivantes non exécutées).

## Référence indépendante

Le code officiel v11.1 a été extrait du commit `bb25864082819775d6ce65d860cbe30806c01e54` dans un dossier séparé. Une archive ZIP figée et les empreintes SHA-256 des fichiers installables permettent de le retrouver. Il n’y avait pas de dossier `data/` privé dans le dépôt; tous les serveurs de test ont utilisé des dossiers temporaires et des finances fictives. Aucun accès à la base du Mac n’est revendiqué.

| Vérification | Référence v11.1 | Livraison v11.2 |
| --- | ---: | ---: |
| Tests Node | 65 réussis | 74 réussis |
| Tests API | 176 réussis | 176 réussis |
| 51 scripts Python supplémentaires existants | 37 réussis, 14 échecs | 37 réussis, les mêmes 14 échecs |
| Nouveau parcours migration puis retour réel au code 11.1 | Sans objet | Réussi |

**Aucun nouvel échec parmi les 51 scripts comparés. La suite complète d’interface n’est pas verte.** Les échecs ci-dessous existaient avant les changements. Ils ne sont ni supprimés ni transformés en tests ignorés; le lanceur renvoie un échec global tant qu’ils persistent. Leur réparation est un chantier distinct; les observations ci-dessous décrivent le point d’arrêt des tests, sans prétendre que tout le reste de ces parcours a été vérifié.

## Conservation et retour arrière

Les nouveaux tests vérifient :

- Adoption du schéma 11.1 avec toutes les tables inchangées; seule la version de schéma passe de 0 à 1.
- Sauvegarde SQLite cohérente incluant les transactions dans le WAL; permissions privées et pas d’écrasement d’une sauvegarde précédente.
- Reconstruction explicite des anciennes récurrences, sans réécrire du SQL stocké par regexp; IDs, exceptions, mouvements et liens conservés.
- Transaction de migration annulée en cas d’erreur; marqueur et données d’origine conservés. Refus des schémas inconnus/futurs et des personnalisations qui pourraient être perdues.
- Restauration effective d’une sauvegarde sur une base isolée, puis nouvelle migration.
- Démarrage sur le vrai code v11.1, passage au nouveau code, puis retour au vrai code v11.1 après ajout d’une transaction : tables financières et prévisions identiques, transaction supplémentaire conservée.
- Montants actuels, minimum/maximum 30/60/90, prévision complète à 90 jours, liste quotidienne visible et chiffres quotidiens partagés inchangés après migration.
- Copie indépendante du code v11.1, vérification des empreintes, refus d’une copie modifiée. Installation des nouveaux modules dans le dossier stable; simulation du cycle de service et sauvegardes existantes.

Les trois anciens tests API de migration ont été adaptés au nouveau nom de sauvegarde. Les fixtures qui recréent un ancien schéma remettent explicitement `user_version=0`; leurs assertions sur les montants, IDs, liens et sauvegardes sont conservées.

## Échecs préexistants relevés

| Script | Point d’arrêt déjà présent en v11.1 |
| --- | --- |
| `budget-v41-ui.py` | Recherche attendue dans l’ancien en-tête sur mobile. |
| `budget-v43-ui.py` | Formulaire de catégorie attendu ouvert dans la nouvelle liste repliable. |
| `budget-v44-ui.py` | Ancienne fenêtre de calcul attendue depuis un indicateur masqué du tableau de bord. |
| `budget-v50-ui.py` | Attente de l’ancien attribut data-night-surface après activation du thème sombre. |
| `budget-v51-ui.py` | Numéro de version historique codé en dur. |
| `budget-v53-ui.py` | Ancien indicateur « jusqu’à la paie » masqué en mode essentiel. |
| `card-envelope-protection-ui.py` | Ancien panneau de périodes masqué dans le tableau de bord essentiel. |
| `card-payments-ui.py` | Ancienne tuile de récurrence recherchée au lieu du tableau actuel. |
| `categories-v46-ui.py` | Sélecteur summary ambigu depuis l’ajout des vues enregistrées. |
| `free-budgets-ui.py` | Bouton de confirmation de réservation désactivé dans le scénario testé. |
| `planning-ui.py` | Nombre historique de boutons de navigation codé en dur. |
| `setup-completion-ui.py` | Bouton État des données attendu dans l’en-tête mobile. |
| `sillage-2026-ui.py` | Numéro v11.0.0 codé en dur. |
| `ui-smoke.py` | Graphique historique attendu visible dans le tableau de bord essentiel. |

## Reproduction et limites

```sh
npm test
python3 tests/migration-rollback-ui.py
python3 tests/run-python-checks.py
```

`run-python-checks.py` conserve un journal par script et un `results.json` dans un dossier temporaire. Les [résultats avant/après](phases-0-1-results.json) gardent les codes de sortie de chaque script, y compris ceux en échec. Les durées varient selon la machine; elles ne constituent pas un engagement de performance.

Environnement : Node 24, SQLite natif, Python/Playwright et Chromium sous Linux. Safari natif, Gatekeeper, launchctl et Tailscale réels nécessitent encore une vérification sur le Mac. Le cycle de service est simulé et l’accès privé est couvert par les tests existants; cela ne constitue pas la phase d’audit complet de sécurité.
