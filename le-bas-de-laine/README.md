# Le bas de laine · 1.0.0

Budget personnel local, en français, avec trois écrans : **Aujourd’hui**, **Transactions**, **Plan**. Node.js et SQLite, sans dépendance de production, abonnement ni synchronisation bancaire. Sillage et ses données restent séparés.

## Installer ou mettre à jour sur Chromebook

Linux doit être activé; Node.js **22.13 ou plus récent** est requis (Node 24 recommandé). Téléchargez et extrayez l’archive dans **Fichiers Linux**, puis :

```bash
cd ~/Le-bas-de-laine-1.0.0 && bash "Installer Le bas de laine.sh"
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
- Transactions : saisie, CSV avec aperçu, règles de classement, révision et catégorie en lot avec effet chiffré avant confirmation.
- Plan : revenus et factures, limites, calendrier, budget mensuel, comptes et sauvegardes.

Le budget mensuel est une vue globale des règles actuelles et des transactions. Il compte les dates réelles, sans moyenne annualisée, mais ne conserve pas les anciennes versions des budgets. Il ne réserve pas une seconde fois l’argent.

## Sauvegarder et revenir en arrière

Exportez régulièrement le JSON depuis Plan et gardez-le hors du Chromebook. Les copies SQLite quotidiennes sont locales. Le JSON 3 conserve règles, marqueurs et liens privés; les anciens JSON 1 et 2 restent restaurables. **Une restauration remplace le budget courant**, avec copie préalable. Gardez les exports et liens privés confidentiels.

Après une mise à jour effectuée par la 1.0.0, ce bloc, lancé dans son dossier décompressé, rétablit le programme **et le budget d’avant la mise à jour** :

```bash
bash "Revenir a la version precedente.sh" --confirmer
```

Le budget le plus récent est conservé séparément et son chemin s’affiche. Ne restaurez pas un JSON récent dans une ancienne version incompatible. Le script vérifie que le programme correspond à la copie de données et restaure la situation courante si le retour ne démarre pas.

## iPhone

Configurez Tailscale sur le Chromebook et l’iPhone, puis lancez au besoin `bash "Configurer acces iPhone.sh"`. Le port HTTPS privé est **8443**, distinct du port Sillage 443. Le lien simplifié créé dans Plan est en lecture seule et reste valable après les mises à jour. Il donne les mêmes montants quotidiens et le même minimum 30 jours. Dans Safari : **Partager → Sur l’écran d’accueil**.

## Vérifications et historique

`npm test` lance les tests Node; les parcours Chromium, essais de restauration et limites de validation sont décrits dans [docs/TESTS.md](docs/TESTS.md). Les essais automatisés ne remplacent pas l’utilisation réelle sur Chromebook et iPhone. L’historique des versions est dans [CHANGELOG.md](CHANGELOG.md), le contrat de calcul dans [docs/SPECIFICATION.md](docs/SPECIFICATION.md). Les anciennes maquettes statiques restent des documents de référence.
