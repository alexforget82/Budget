# Protection de chaque période — v11.4.2

## Problème corrigé

Avec un budget protégé sans report, la prévision réutilisait une réserve de 230 $ d’une semaine à l’autre. Un renouvellement pouvait donc afficher « Réserve inchangée », alors que l’utilisateur prévoyait 230 $ d’achats supplémentaires chaque semaine. Le Safe-to-Spend prévu était surestimé. La v11.4.1 rendait ce renouvellement visible, mais ne corrigeait pas le calcul.

La v11.4.2 protège séparément chaque période future des budgets protégés, quelle que soit leur fréquence. La correction s’applique aux enveloppes existantes et futures, sans modifier leurs réglages ni créer de transactions.

## Exemple isolé

Avec 1 000 $ au compte, une enveloppe de 230 $ par semaine, à partir du jeudi 22 octobre 2026, sans autre opération :

| Date | Solde bancaire | Montants protégés dans la prévision | Safe-to-Spend prévu |
| --- | ---: | ---: | ---: |
| 22 octobre | 1 000 $ | 230 $ | 770 $ |
| 28 octobre | 1 000 $ | 230 $ | 770 $ |
| 29 octobre | 1 000 $ | 460 $ | 540 $ |
| 5 novembre | 1 000 $ | 690 $ | 310 $ |

La protection future est une prévision d’engagements, pas un débit bancaire fictif. Elle n’ajoute aucune dépense réelle. Les réserves futures peuvent dépasser le solde et rendre le disponible négatif : cela signale que les engagements dépassent les fonds prévus.

## Avances et dépenses réelles

Une alimentation anticipée couvre uniquement l’occurrence qui lui est attribuée. Un achat anticipé associé à cette période, sur carte ou compte inclus, réduit ce qu’il reste à protéger. L’alimentation et l’achat ne sont pas comptés une deuxième fois à l’échéance. Les sommes utilisées sur une carte restent protégées jusqu’à son remboursement; la dette initiale d’une carte n’est toujours pas réservée automatiquement.

Les dépenses à date précise continuent à consommer leur réservation selon leur calendrier. Les exceptions de montant, périodes à zéro et fins de programmation restent respectées.

Le choix « Conserver le restant » ou « Remplacer le restant » concerne toujours le renouvellement réel. Si une période est réellement terminée sans que tout son budget ait été utilisé, le mode sans report peut libérer ce restant. La prévision ne suppose plus à l’avance que le même argent financera toutes les périodes suivantes. Les anciens paiements manquants ne deviennent pas des transactions automatiques.

Le tableau de bord, les prévisions, les simulations d’achat et la vue simplifiée utilisent le moteur commun corrigé. Le montant « maintenant » conserve sa définition : solde réel admissible moins protections actuelles; les minima et montants futurs intègrent les prochaines périodes.

## Vérification

Les nouveaux tests reproduisent d’abord l’échec, puis vérifient les six fréquences, l’exemple du 28/29 octobre, les avances partielles/complètes et les achats sur compte/carte sans avance. Des tests API vérifient aussi le redémarrage, la restauration, le remboursement d’une carte, les simulations et les trois horizons partagés.

Quatre attentes historiques ont été corrigées : elles supposaient le réemploi de la même réserve ou un minimum limité au premier mois. La réservation hebdomadaire insuffisamment financée demande désormais l’acquittement du disponible négatif dans son test, comme dans l’interface.

La comparaison historique de styles et de calculs utilise une enveloppe avec report actif pour isoler les chemins inchangés. Le changement intentionnel des enveloppes sans report est couvert séparément par les nouveaux tests; il n’est pas déclaré identique à la v11.3.

Résultat : **87 tests Node et 186 tests API réussis**. La suite Python complète termine à **55/56**; le test de rappel marchand des catégories, déjà intermittent, réussit à la relance ciblée. Aucun test n’a été supprimé ou ignoré. Les [résultats détaillés](protection-periodes-11.4.2-results.json) conservent les deux résultats. Les essais utilisent des données fictives sous Linux/Chromium, et non les finances du Mac ou Safari/iOS natif.

## Vérification complémentaire de tous les types d’enveloppes

Le code de la v11.4.2 n’a pas changé. Huit tests supplémentaires couvrent **304 configurations** : six fréquences, deux modes d’enveloppe, deux choix de report, compte conjoint et trois cartes, avances, achats anticipés, calendriers liés aux catégories, exceptions, compte personnel et réserve récurrente en double. Un cas mélange cinq enveloppes et vérifie séparément leurs engagements sur 750 jours; cela permet aussi de contrôler plusieurs échéances annuelles.

La suite Node complète passe à **95 tests réussis** et les **186 tests API passent**. Les enveloppes sans programmation ou suspendues conservent leur réserve actuelle, sans créer d’échéance imaginaire. Ces vérifications portent sur le moteur avec des données fictives; elles ne constituent pas une inspection des réglages enregistrés sur le Mac de l’utilisateur. Aucune nouvelle installation n’est nécessaire pour un utilisateur déjà en v11.4.2.
