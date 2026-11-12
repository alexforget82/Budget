# Le bas de laine · 1.3.0

Budget personnel local, en français, avec trois écrans : **Aujourd’hui**, **Transactions**, **Plan**. Node.js et SQLite, sans dépendance de production, abonnement ni synchronisation bancaire. Sillage et ses données restent séparés.

## Installer ou mettre à jour sur Chromebook

Linux doit être activé; Node.js **22.13 ou plus récent** est requis (Node 24 recommandé). Téléchargez et extrayez l’archive dans **Fichiers Linux**, puis :

```bash
cd ~/Le-bas-de-laine-1.3.0 && bash "Installer Le bas de laine.sh"
```

Ouvrez **http://localhost:3040** ou le lanceur **Le bas de laine**, puis actualisez après une mise à jour. Le programme va dans `~/.local/share/le-bas-de-laine/app`, le budget dans `data`, les copies d’installation dans `backups`. Le service `le-bas-de-laine.service` fonctionne sans Terminal ouvert et démarre avec Linux. ChromeOS ne lance pas forcément Linux à l’ouverture de session; l’accès iPhone nécessite un Chromebook allumé, éveillé et connecté.

L’installation sauvegarde les données avant de remplacer le programme. Si le démarrage échoue, programme **et données** précédents sont rétablis, avec conservation séparée de la copie échouée. Aucune donnée bancaire réelle n’est livrée dans l’archive.

## Comprendre le disponible

Le chiffre principal est le **minimum prévu des 30 prochains jours**, après les factures, les achats de carte à payer et toutes les limites qui se renouvellent dans cette fenêtre. Le graphique et le curseur utilisent exactement la même prévision. À surveiller signale un minimum supplémentaire sur 90 jours; le montant avant le prochain revenu reste secondaire.

Les quatre lignes expliquent le jour du minimum : solde bancaire calculé, cartes déjà à payer, mouvements prévus nets des revenus et paiements, limites protégées. Les montants sont en cents entiers. Ce disponible prévu n’est pas un solde bancaire et dépend des opérations saisies.

Une limite protège automatiquement son restant et ses prochaines allocations. À la semaine, les restants se reportent dans le même mois de renouvellement et s’effacent au premier renouvellement du nouveau mois, sans réduire l’allocation. Les limites mensuelles et deux fois par mois ne reportent pas le restant. **75 $ deux fois par mois = 150 $ par mois** : le montant est par passage.

Un achat sur carte consomme sa limite et devient à payer; le paiement de carte diminue le solde bancaire et libère cette protection, sans seconde déduction du disponible. Les dettes antérieures non saisies et les dépenses oubliées ne sont pas devinées.

## Utiliser l’application

**Plan → Réglages et sauvegardes → Guide d’utilisation** ouvre le guide intégré, également disponible à `/guide`. Il décrit la configuration, la saisie, les achats anticipés, les cartes, les sauvegardes et l’iPhone.

- Aujourd’hui : minimum 30 jours, prévision quotidienne, limites et simulateur d’achat.
- Transactions : saisie, CSV avec aperçu, règles par commerçant, file À classer, recherche, filtres, tri et catégories en lot avec effet chiffré avant confirmation.
- Plan : revenus et factures, limites, calendrier, budget mensuel, comptes et sauvegardes.

Le budget mensuel est une vue globale des règles actuelles et des transactions. Il compte les dates réelles, sans moyenne annualisée, mais ne conserve pas les anciennes versions des budgets. Il ne réserve pas une seconde fois l’argent.

## Sauvegarder et revenir en arrière

Exportez régulièrement le JSON depuis Plan et gardez-le hors du Chromebook. Les copies SQLite quotidiennes sont locales. Le JSON 3 conserve règles, marqueurs et liens privés; les anciens JSON 1 et 2 restent restaurables. **Une restauration remplace le budget courant**, avec copie préalable. Gardez les exports et liens privés confidentiels.

Après une mise à jour effectuée par la 1.0.0 ou plus récente, ce bloc, lancé dans son dossier décompressé, rétablit le programme **et le budget d’avant la mise à jour** :

```bash
bash "Revenir a la version precedente.sh" --confirmer
```

Le budget le plus récent est conservé séparément et son chemin s’affiche. Ne restaurez pas un JSON récent dans une ancienne version incompatible. Le script vérifie que le programme correspond à la copie de données et restaure la situation courante si le retour ne démarre pas.

## iPhone

Configurez Tailscale sur le Chromebook et l’iPhone, puis lancez au besoin `bash "Configurer acces iPhone.sh"`. Le port HTTPS privé est **8443**, distinct du port Sillage 443. Le lien simplifié créé dans Plan est en lecture seule et reste valable après les mises à jour. Il donne les mêmes montants quotidiens et le même minimum 30 jours. Dans Safari : **Partager → Sur l’écran d’accueil**.

## Vérifications et historique

`npm test` lance les tests Node; les parcours Chromium, essais de restauration et limites de validation sont décrits dans [docs/TESTS.md](docs/TESTS.md). Les essais automatisés ne remplacent pas l’utilisation réelle sur Chromebook et iPhone. L’historique des versions est dans [CHANGELOG.md](CHANGELOG.md), le contrat de calcul dans [docs/SPECIFICATION.md](docs/SPECIFICATION.md). Les anciennes maquettes statiques restent des documents de référence.

## Résumé du matin sur iPhone (1.3.0)

Sur l’iPhone propriétaire, ouvrez la version complète depuis son icône d’écran d’accueil, puis **Plan → Réglages et sauvegardes → Notifications du matin → Activer sur cet appareil**. Acceptez l’autorisation iOS et utilisez **Envoyer un test**. Si vous êtes dans Safari, ajoutez d’abord l’application à l’écran d’accueil. iOS 16.4 ou plus récent et l’accès HTTPS privé configuré sont requis.

Le résumé part vers **7 h, heure du Québec (America/Toronto)**, avec changement d’heure automatique. Le Chromebook, Linux et le serveur doivent être éveillés et connectés. Reprise possible entre 7 h et 8 h; pas de rattrapage plus tard. Les modes Concentration, les réglages de l’iPhone et le service de notifications peuvent retarder la livraison. Aucun envoi ni permission n’est activé par la mise à jour seule.

Par défaut, le contenu dit seulement que votre résumé est prêt. L’option Afficher les montants et les noms permet d’inclure les revenus/paiements **prévus**, les renouvellements automatiques et les limites utilisées à **80 % ou plus**. Ce sont des prévisions, pas une confirmation bancaire. Les alertes sont regroupées dans le résumé, sans rappels répétés durant la journée. Les limites ne demandent pas de transfert manuel.

Chaque appareil s’active séparément. Désactivez cet appareil ou suspendez tous les rappels depuis ce panneau. Le lien simplifié de la conjointe n’a pas ces commandes et ne reçoit rien sans activation propriétaire. Le bouton Test vérifie l’acceptation par le service; confirmez ensuite la réception sur l’iPhone.

Envoi Web Push chiffré, sans clé API payante ni dépendance de production. Les clés locales et abonnements sont dans `data/web-push.json`, permissions privées, exclus de l’export JSON du budget. Ils restent dans les copies complètes de données faites lors des installations; une restauration du budget sur une autre machine exige de réactiver les appareils. Ne partagez pas ce fichier. Le service worker ne cache pas de pages et ne récupère pas de données financières en arrière-plan.

## Nouveautés 1.3

Transactions se lit comme un grand livre compact : choisissez le tri par date, montant, description ou catégorie. Lors d’une sélection, le total et la moyenne sont affichés avant toute action. Les opérations importées ou encore non validées sont signalées dans la liste, avec un accès direct à la file **À classer**. Les règles par commerçant, l’import CSV et les calculs du disponible ne changent pas.

## Nouveautés 1.2

Les revenus attendus aujourd’hui et ceux des 30 derniers jours restent visibles tant que leur réception n’est pas confirmée. **Reçue** demande le montant réel et la date. Cochez **Déjà compris dans le solde bancaire de référence** uniquement si votre dernier solde saisi comprend ce dépôt : il sera clos sans ajouter l’argent une deuxième fois. Les revenus futurs restent dans la prévision; un revenu arrivé à échéance attend votre confirmation.

À la saisie, les commerçants récents proposent la catégorie et le moyen de paiement, modifiables. Le montant reste vide et la date reste celle du jour. Une modification manuelle de catégorie ou de compte garde priorité.

Dans Notifications du matin, **J’ai reçu le test** confirme votre observation, distincte de l’acceptation par le service de push. Même principe pour le dernier résumé du matin. L’application ne peut pas prouver seule que l’iPhone a affiché la notification.

**Plan → Réglages et sauvegardes → Mises à jour** vérifie la dernière version publiée. Une vérification quotidienne ne télécharge que les informations publiques de version GitHub, sans données du budget; elle peut être désactivée. L’installation reste volontaire : télécharger, extraire, lancer le bloc indiqué, actualiser. L’installateur sauvegarde avant remplacement. Une erreur de connexion ne bloque pas le budget. Les commandes de mise à jour et de notifications restent réservées à la version complète.
