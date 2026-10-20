# Versions de Sillage

## 11.4.0 — organisation et robustesse, étapes 2 à 5

- Base et transactions SQLite, calendrier des récurrences, routes par domaine, lecture HTTP, fichiers statiques et contrôles d’accès séparés du serveur principal. Calculs conservés.
- Une entrée JavaScript native ES, initialisation explicite par domaine et un pont de compatibilité pour les anciens points d’accès. Pas de compilation ni de dépendance npm à l’exécution.
- Quatre feuilles CSS faisant autorité, regroupées par responsabilité, avec couches de cascade et palette isolée. Anciennes URL conservées comme petits renvois; trois `!important` redondants retirés après comparaison. Les autres priorités restent conservées pour préserver l’apparence.
- Ressources de l’interface versionnées pour le cache Safari, fichiers installables vérifiés avant l’arrêt du service, copie installée testée.
- Contrôles JSON exacts, limites mesurées en octets, corps non objet refusés avant mutation et jeton de consultation malformé traité en refus d’accès.
- README raccourci, architecture, sécurité et historique séparés. Tests anciens adaptés à la navigation réelle, sans supprimer leurs contrôles financiers.

Cette version ne constitue pas une refonte mobile ni un hébergement Internet public. La vue simplifiée et les règles du Safe-to-Spend restent conservées. Les sauvegardes et le retour à la v11.1 restent disponibles.

## 11.3.0 — occurrences réelles dans Budget

Comptage des dates du mois pour les budgets à la semaine et aux deux semaines : 4/5 ou 2/3 occurrences. Montant unitaire conservé, choix de calendrier explicite si nécessaire, sous-catégories et exceptions maintenues. Safe-to-Spend inchangé.

## 11.2.0 — étapes 0 et 1

Référence de tests, migrations numérotées et atomiques, sauvegardes cohérentes avant migration et retour au code v11.1 avec conservation des transactions.

## 11.1.0 — association proposée à la saisie

Proposition de rapprochement entre une transaction réelle et une échéance proche, à confirmer. Évite de déduire deux fois la même opération.

## 11.0.0 — Sillage 2026

Identité visuelle Sillage 2026, navigation regroupée et harmonisation des écrans.

Les [notes et guides historiques complets](docs/versions-archive.md) restent disponibles. Les tags Git figent les versions livrées.
