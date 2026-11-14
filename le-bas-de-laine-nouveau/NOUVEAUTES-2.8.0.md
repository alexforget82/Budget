# Le Bas de Laine 2.8.0 — Transactions express

Cette version rend la saisie d’un achat courant plus courte, sans changer le
calcul du Safe-to-Spend ni vos données.

- Dans **Ajouter une transaction**, les cinq derniers commerçants différents
  apparaissent comme raccourcis. Un toucher reprend le nom, la limite et le
  moyen de paiement du dernier achat semblable.
- Si vous tapez un commerçant déjà utilisé, sa dernière limite et son dernier
  moyen de paiement sont proposés automatiquement. Vous restez libre de les
  modifier avant d’enregistrer.
- Une **règle de commerçant** explicite garde toujours priorité sur
  l’historique. Elle continue aussi de servir à l’import CSV.
- Aucun achat n’est associé automatiquement à une facture prévue. La
  suggestion « Associer » reste volontaire et visible, pour éviter tout double
  compte.

La version iPhone de votre femme reste inchangée et en lecture seule à
`/simple`.
