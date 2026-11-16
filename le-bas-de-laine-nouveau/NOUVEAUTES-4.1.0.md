# Le Bas de Laine 4.1.0 — Registre budgétaire

Cette version poursuit la refonte visuelle commencée en 4.0. Les calculs de
Safe-to-Spend, les limites, les récurrences, les transactions et les données ne
changent pas.

## Une interface moins chargée

- L’accueil enlève plusieurs cadres intérieurs : le disponible, les prochains
  repères et le graphique se lisent comme une seule surface de travail.
- **Transactions** est une grille dense et plate, avec des filtres en haut et
  un total de période en bas.
- **Budget** est présenté comme un tableau : une ligne par catégorie et les
  colonnes Budget, Dépensé et Restant.
- **Calendrier** laisse la priorité à sa grille mensuelle.

## Plan réorganisé

La page **Plan** a maintenant quatre onglets :

1. Revenus;
2. Factures;
3. Limites;
4. Solde et données.

Une seule liste est ouverte à la fois. Les actions de modification restent les
mêmes. Le bouton **+ Facture** prépare directement une facture, et **+ Revenu**
un revenu.

## iPhone

La vue complète profite de la même présentation plus sobre. La vue simple de
votre conjointe reste disponible à la même adresse `/simple` et ne change pas
de rôle.

La mise à jour crée une copie complète de vos données avant le redémarrage et
revient automatiquement à la version précédente si elle ne répond pas.
