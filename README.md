# Mon Budget local — v2.1.0 (version d'essai)

Application locale pour Mac, Node.js 22 ou plus, SQLite. Aucun CDN, aucune compilation ni dépendance npm externe.

## Mise à jour sans perte de données

1. Arrêter complètement le serveur (`Control + C`).
2. Faire une **copie intégrale** du dossier de l'application, notamment du dossier `data/` (avec `budget.sqlite`, `-wal`, `-shm` s'ils existent). Ne jamais supprimer `data/`.
3. Décompresser l'archive et remplacer uniquement les fichiers applicatifs : `server.js`, `index.html`, `app.css`, `app.js`, `package.json`, `README.md`.
4. Conserver le dossier `data/` actuel au même endroit, à côté de `server.js`.
5. Redémarrer avec `npm start` et ouvrir `http://127.0.0.1:3030` dans Safari. Recharger sans cache si nécessaire (`Cmd + Option + R`).

Au premier lancement de la v2.1, une copie des fichiers SQLite est créée dans `data/backups/` **avant** les migrations additives. Une copie manuelle complète reste recommandée. La v2.1 ajoute seulement trois tables : `reconciliation_links`, `recurring_moves` et `envelope_budget_overrides`. Les anciennes transactions, comptes, enveloppes et récurrences sont conservés.

## Fonctionnalités v2.1

- Chargement corrigé : une seule requête initiale actualise tous les écrans (la v2.0 avait une requête qui capturait une ancienne fonction de rendu).
- Détail du Safe-to-Spend : comptes inclus, réserves et impacts de chaque mouvement prévu sur 30 jours. Les indicateurs « cette semaine » et « jusqu'à la paie » conservent leurs règles de calcul d'origine (minimum projeté, jusqu'à 30 jours).
- Rapprochement manuel : section **Récurrences**, association d'une transaction ou d'un virement réel avec une occurrence prévue, même si le montant diffère. Le lien ne modifie pas les soldes réels. Une opération réelle ne peut être associée qu'à une seule occurrence; possibilité de délier. Les rapprochements automatiques conservateurs continuent.
- Prévision et calendrier sur **90 jours**; modification du montant d'une occurrence dans **Exceptions** (0 $ pour l'ignorer), déplacement d'une occurrence dans **Exceptions** (avec possibilité d'annuler).
- Enveloppes : affichage du montant réservé, du montant dépensé pendant la période en cours et du prochain renouvellement. Budget exceptionnel d'une seule période future, sans changer la règle habituelle. Graphique 30 jours et barres de progression sur le tableau de bord.
- Transactions et virements modifiables et supprimables, recherche et pagination héritées de v2.0.

## Points à connaître

- **Version d'essai** : vérifier les soldes et le Safe-to-Spend avec une copie de vos données avant d'utiliser le logiciel au quotidien. Les tests automatisés ne remplacent pas un essai réel sur Safari.
- Les soldes bancaires sont saisis manuellement. Les règles récurrentes ne déclenchent pas de virements bancaires.
- Le calendrier mensuel affiche les 50 dernières transactions réelles présentes dans `/api/state`; la recherche et la pagination des transactions permettent d'accéder à l'historique complet. Les prévisions commencent aujourd'hui et vont jusqu'à 90 jours; pas de prévisions rétrospectives.
- L'export CSV couvre la page filtrée affichée, pas tous les résultats.
- L'import CSV, les actions groupées et la synchronisation bancaire ne sont pas inclus.
- Une dépense associée à une enveloppe peut avoir été plafonnée à 0 dans les anciennes versions. La suppression ou modification de cette dépense ne peut pas toujours reconstruire la réserve historique exacte : vérifier les enveloppes après correction.
- Une occurrence déplacée doit être future et à 90 jours au maximum de sa date d'origine. Un budget exceptionnel d'enveloppe doit cibler une date de renouvellement future.
- Les liens manuels sont supprimés automatiquement si une transaction liée est supprimée ou change de compte, de signe ou de date. Un changement de montant conserve le lien.
- La sauvegarde automatique s'effectue au démarrage, quand le serveur précédent est arrêté. Il est important de ne pas lancer deux copies de l'application sur la même base.

## Vérifications réalisées

Tests sur des bases SQLite temporaires : prévision 90 jours, comptes et cartes de crédit, dépenses d'enveloppes, modification/suppression de transactions et virements, rapprochement manuel avec montants différents, refus des doublons et données invalides, déplacement et restauration d'occurrence, budget exceptionnel, migration depuis v1.8 et création d'une sauvegarde. Vérification de l'interface dans Chromium avec réponses API simulées (onglets, Safe-to-Spend, calendrier, 90 lignes de prévision, fenêtres et formulaires), sans erreur JavaScript observée. Safari n'a pas pu être testé ici.
