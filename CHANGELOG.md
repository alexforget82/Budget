# Versions de Sillage

## 13.0.0 — la présentation approuvée devient l’interface réelle

Tableau de bord recentré sur le disponible actuel, avec minimum prévu, détail des protections, graphique, minimum/maximum sur 30/60/90 jours, prochains mouvements, enveloppes et derniers achats. Le graphique réutilise son rendu et ses données existants; le mode détaillé et la personnalisation restent disponibles. Le raccourci vers la prochaine rentrée d’argent est conservé.

Les enveloppes deviennent des cartes compactes avec recherche sans distinction d’accents, filtres de fréquence et détails de gestion repliables. Réserve inutilisée, achats et renouvellement restent distincts. Les contrôles existants d’ajustement, de suppression, de sélection et de configuration conservent leurs actions. Le thème commun et la vue simplifiée reçoivent une finition visuelle; aucun nouveau lien partagé n’est nécessaire. Ressources versionnées, validation de l’installateur mise à jour. Aucun changement du schéma SQLite ni des règles financières.

[Installation, captures et vérifications](docs/SILLAGE-13.md).

## 12.0.0 — récurrences sur carte protégées et repères plus clairs

Les dépenses récurrentes sur carte sans enveloppe réduisent désormais le disponible prévu à leur date, sans diminuer le solde bancaire. Les achats réels identifiés ou explicitement associés au prévu restent protégés jusqu’au remboursement; celui-ci libère la protection sans deuxième déduction. Les paiements partiels, achats anticipés, exceptions et remboursements marchands sont couverts. La dette initiale générale et les imports historiques ne deviennent pas des réserves. La protection des achats récurrents réels démarre à l’activation de la v12, conservée après redémarrage, remise à zéro et restauration. Les associations déjà reconnues restent stables lors d’un changement de tarif; la suppression d’une récurrence ne libère pas un achat réel encore à payer.

Les cartes d’enveloppes précisent la période, le prochain renouvellement et le report, avec la différence entre objectif et protection actuelle. La vue simplifiée affiche le numéro de version et propose de recharger l’interface lorsqu’elle diffère du serveur. Dans Sauvegardes, une vérification manuelle consulte la version publique GitHub et propose le ZIP si elle est plus récente; aucune donnée financière n’est envoyée et aucune installation n’est automatique. Les sauvegardes et le retour à la v11.1 restent disponibles. Guide de validation Safari/iPhone ajouté; essais réalisés sous Chromium, pas sur appareil iOS réel.

## 11.6.0 — comprendre et vérifier son disponible

Les lignes Solde bancaire inclus et Argent protégé ouvrent le détail du calcul actuel ou le chemin quotidien de la prévision. Le tableau de bord indique les comptes inclus à vérifier, la dernière validation et les vérifications devenues obsolètes. Le rapprochement montre le solde enregistré avant saisie et un aperçu du disponible actuel et des minimums sur 30/60/90 jours si ce seul solde était corrigé. L’aperçu utilise le moteur canonique, sans écriture. Les recherches de doublons et de transactions manquantes existantes restent accessibles. Une modification du compte ou des opérations invalide l’aperçu affiché; toute correction exige toujours une action explicite et une note. Sur téléphone, le résultat prend le focus après comparaison. Aucun changement des règles de calcul, des enveloppes ou des remboursements de carte.

## 11.5.2 — épicerie toujours visible

Le suivi partagé reste visible avant la première période : montant prévu et date de début. Sans calendrier, la carte présente la réserve actuelle et indique la configuration manquante. Si aucune enveloppe ne peut être identifiée, un état de configuration remplace la disparition de la carte. Les achats anticipés associés à la première échéance sont inclus. Le lien existant reste valide; calcul du Safe-to-Spend conservé.

## 11.5.1 — épicerie dans la vue simplifiée

Carte de suivi de l’enveloppe active Épicerie : budget de la période, achats associés, restant et prochain renouvellement. Liste d’achats repliable, libellés rendus comme texte, aucun compte ou autre enveloppe exposé. Le montant et le calendrier viennent de l’enveloppe existante; aucun montant de 230 $ ou 203 $ n’est imposé. Le report est respecté lorsque le renouvellement courant a été appliqué. Les achats associés à une autre période ne sont pas déduits deux fois. Actualisation et révocation du lien effacent les données devenues indisponibles. Calcul du Safe-to-Spend conservé.

## 11.5.0 — interface iPhone

Navigation rapide en bas, en-tête compact, version en bas à gauche, options secondaires repliées sur téléphone. Budget : mois lisible et montants sans coupure. Transactions : filtres regroupés pour laisser voir les opérations. Prévision : compte et scénarios regroupés, résumé compact. Calendrier mobile initial en semaine avec choix du mois conservé. Formulaires adaptés au toucher, fenêtres en bas d’écran et prise en compte des zones de sécurité. Vue simplifiée plus compacte. Contrôles et gestionnaires existants réutilisés, calculs conservés; disposition ordinateur restaurée au changement de largeur.

## 11.4.3 — fichier pour poser des questions dans ChatGPT

Ajout dans Outils et réglages : préparer et vérifier un instantané financier, le télécharger puis ouvrir ChatGPT pour le joindre à une question. Historique au choix (90 jours, un an, tout), comptes, budgets, enveloppes, récurrences et prévisions canoniques. Aucun envoi automatique ni clé API. Export propriétaire distinct des sauvegardes, sans configuration ni jeton d’accès. Calculs financiers conservés.

## 11.4.2 — protection de chaque période future

Corrige une surestimation du Safe-to-Spend lorsque plusieurs périodes d’un budget protégé réutilisaient la même réserve avec le report désactivé. Chaque semaine/mois futur protège son propre montant. Les alimentations anticipées et achats associés au début de période sont comptés une seule fois, sur compte bancaire ou carte. Les soldes réels et la règle de report lors du renouvellement réel restent conservés. La v11.4.1 ne corrigeait que l’affichage de ces échéances.

## 11.4.1 — renouvellements d’enveloppes au calendrier

Les renouvellements hebdomadaires restent visibles lorsque la réserve supplémentaire est nulle. Le détail indique « Réserve inchangée » lorsque le renouvellement ne change pas le disponible. Les calculs, les choix de report et les soldes bancaires restent inchangés.

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
