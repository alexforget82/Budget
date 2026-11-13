# Le Bas de Laine 2.1.0

## Vérifier mon solde, sans deviner

La vérification de solde montre maintenant ce qui explique le montant prévu :

- les revenus, dépenses du compte conjoint et paiements de carte saisis depuis
  le dernier solde confirmé ;
- les éléments prévus aujourd’hui qui entrent dans le solde projeté ;
- les échéances passées qui attendent encore d’être payées, déplacées ou
  ignorées.

Touchez une opération pour la modifier directement. Les achats sur carte sont
clairement séparés : ils ne touchent pas le solde bancaire avant le paiement de
la carte.

## Calendrier extensible

Quand une journée contient trop d’éléments, **+ autres** est maintenant un
bouton. Il ouvre la liste complète de la journée, avec les mêmes actions que
dans le calendrier : modifier, payer, déplacer, ignorer ou consulter Plan.

## Installation

Lancez `Mettre-a-jour-Le-Bas-de-Laine-2.1.0.sh` depuis l’archive. Il sauvegarde
vos données, installe la nouvelle version puis vérifie le service sur le port
3045. Si le démarrage échoue, l’ancienne version et les données sont remises en
place automatiquement.
