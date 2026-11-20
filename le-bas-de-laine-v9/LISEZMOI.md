# Le Bas de Laine v9 (prototype séparé)

Cette application redémarre avec une seule idée : montrer le disponible du
compte conjoint aujourd’hui et le point le plus bas des 30 prochains jours.

## Installation Chromebook / Linux

1. Décompressez l’archive.
2. Ouvrez le Terminal Linux dans le dossier décompressé.
3. Lancez :

   ```bash
   bash "Installer Le bas de laine v9.sh"
   ```

4. Ouvrez `http://localhost:3050`.

Le service redémarre automatiquement avec Linux. Il n’écrase jamais les
anciens dossiers ni leurs bases de données.

## iPhone

Avec Tailscale connecté, utilisez l’adresse affichée par l’installateur :

`http://ADRESSE-TAILSCALE:3050`

- Votre vue complète est à cette adresse.
- La vue limitée pour votre femme est à `/simple`.

Dans Safari, utilisez **Partager → Sur l’écran d’accueil** pour l’ouvrir comme
une application.

## Règle du disponible

```
solde réel du compte
− réserves des limites déjà déclenchées
= disponible aujourd’hui
```

Dans les jours suivants, les revenus, factures, transactions planifiées et
prochaines protections de limites font varier le montant. Une dépense dans une
limite réduit le solde réel et consomme sa réserve en même temps : elle ne peut
donc jamais être retirée deux fois.

## Sauvegardes

- Une copie SQLite est créée quotidiennement dans `data/sauvegardes`.
- Réglages → **Télécharger mes données** exporte un JSON manuel.
- Avant chaque mise à jour de v9, l’ancien dossier de l’application est copié
  dans `backups`. Les données ne sont pas remplacées.

## État du projet

La v9 est volontairement séparée de Sillage et des anciennes versions. Ne
copiez aucune donnée réelle tant que les calculs de vos 30 jours ne sont pas
comparés et validés.
