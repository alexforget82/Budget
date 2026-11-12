# Le Bas de Laine 1.0

Le Bas de Laine est une nouvelle application séparée. Son dossier de données ne
lit pas et ne modifie pas les données des versions précédentes.

## Démarrage sur Chromebook

1. Décompressez l’archive.
2. Dans le terminal Linux, ouvrez le dossier décompressé.
3. Lancez :

   ```bash
   bash "Installer Le Bas de Laine.sh"
   ```

4. Ouvrez **Le Bas de Laine** depuis le lanceur Linux, ou allez à
   `http://localhost:3045`.

Le service est démarré par systemd à chaque ouverture de Linux. Les données sont
conservées dans `~/.local/share/le-bas-de-laine-nouveau/data` et une sauvegarde
SQLite quotidienne y est créée automatiquement.

## Première configuration

Le tutoriel demande uniquement le solde réel du compte conjoint. Dans **Plan**,
ajoutez ensuite vos revenus, vos factures fixes et vos limites. Vous pouvez le
faire dans n’importe quel ordre : le bandeau de départ montre ce qu’il reste à
faire.

Pour la RRQ, créez une règle mensuelle et choisissez **Dernier jour ouvrable du
mois**. Une date publiée par Retraite Québec peut toujours être déplacée
ponctuellement dans le calendrier.

## Calcul du disponible

Chaque jour, l’application calcule :

```
solde réel du compte conjoint
− achats de carte à payer
− factures prévues
− réserves des limites
= disponible prudent
```

Une limite hebdomadaire se reporte à chaque renouvellement du même mois. Au
changement de mois, ce report repart à zéro. Les transactions classées dans une
limite réduisent son restant sans retirer le disponible une deuxième fois.

## iPhone avec Tailscale

Gardez Tailscale connecté sur le Chromebook et sur l’iPhone. Depuis l’iPhone,
ouvrez l’adresse Tailscale du Chromebook avec le port `3045`, par exemple :

```
http://100.x.y.z:3045
```

La vue complète est à cette adresse. La vue simplifiée de votre conjointe est à
`/simple`, par exemple `http://100.x.y.z:3045/simple`.

Si vous préférez utiliser une adresse `https://…ts.net`, vérifiez d’abord votre
configuration actuelle avec `tailscale serve status`, car modifier Tailscale
Serve peut remplacer l’adresse d’une ancienne application.

## Sauvegarde et export

Dans **Plan**, utilisez **Exporter mes données** pour télécharger un fichier
JSON. Les sauvegardes quotidiennes sont des fichiers SQLite : elles servent à
récupérer une base locale si nécessaire.

## Limite financée par revenu

Pour une limite mensuelle à échéance, ouvrez-la dans **Plan** et choisissez
**Au prochain revenu qui le permet**. L’application ne la retire pas du
montant disponible dès le début du mois : elle la gèle automatiquement au
premier revenu qui couvre les factures, les cartes et les limites prioritaires
jusqu’au prochain revenu. Si ce n’est pas possible, elle reste signalée comme
montant à couvrir avant son échéance.

## Nouveautés 1.4.0 — transactions

Transactions peut maintenant être trié par date, montant, description ou limite et filtré par mois. Les règles de commerçant proposent une limite pour les nouveaux achats et les imports, sans modifier vos transactions ou récurrences passées. Le CSV se lit et se classe dans l’application avant l’import; les lignes sans limite restent visibles dans **À classer**. Réimporter le même fichier n’ajoute pas de doublon.
