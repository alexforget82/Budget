# Le Bas de Laine 3.4.0 — Budget mensuel, protection hebdomadaire

Cette version ajoute un nouveau mode de limite, sans modifier les calculs des
limites qui existent déjà.

## Épicerie : un budget du mois, sans tout geler le 1er

- Dans **Plan → Limites**, choisissez **« Budget mensuel, protégé chaque
  semaine »**.
- Vous inscrivez un budget pour les mois à 4 renouvellements et un autre pour
  les mois à 5 renouvellements.
- Exemple configuré pour l’épicerie : **950 $** dans un mois à 4 jeudis,
  **1 125 $** dans un mois à 5 jeudis.
- L’argent est protégé seulement chaque jeudi : 237,50 $ par jeudi dans le
  premier cas; 225 $ par jeudi dans le second.

Vous pouvez donc faire une grosse épicerie une semaine. Le budget suit le total
du mois; le Safe-to-Spend protège seulement les portions déjà arrivées et les
prochaines portions apparaissent dans la prévision jour par jour.

## Ce qui est visible

- Accueil et Plan : le restant mensuel, le montant déjà protégé et la prochaine
  portion sont indiqués ensemble.
- Budget : Épicerie est bien présentée comme un budget mensuel, avec Budget,
  Dépensé et Restant.
- Vue simple iPhone : Épicerie affiche le restant du mois, les achats du mois,
  la réserve active et le prochain jeudi.

## Données existantes

À la première ouverture, la limite existante nommée **Épicerie** est convertie
avec 950 $ / 1 125 $ et le jeudi comme jour de renouvellement. Toutes les
autres limites et transactions restent inchangées. La mise à jour crée une copie
complète de vos données avant de démarrer la nouvelle version.
