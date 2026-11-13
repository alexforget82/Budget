# Le Bas de Laine 2.2.0

## Safe-to-Spend lisible au premier regard

L’accueil met maintenant en évidence :

- le minimum prévu sur 30 jours ;
- le minimum avant le prochain revenu ;
- le calcul d’aujourd’hui : **compte conjoint − cartes à payer − limites
  réservées = disponible maintenant**.

Le statut indique simplement si la prévision est stable, à surveiller ou à
corriger. Le graphique et son curseur restent juste dessous pour comprendre les
variations jour par jour.

## Calendrier historique

Les flèches du calendrier permettent de consulter les mois où une opération ou
une échéance confirmée existe. Un mois passé est clairement identifié comme
**Historique réel** : aucune projection de disponible n’y est fabriquée.

## Import CSV plus sûr

Le même relevé est maintenant détecté même si la banque change l’ordre de ses
lignes. Les imports 1.x et 2.0/2.1 restent reconnus, donc ils ne sont pas
importés une deuxième fois.

## Installation

Exécutez `Mettre-a-jour-Le-Bas-de-Laine-2.2.0.sh` depuis l’archive. Vos données
sont sauvegardées avant la mise à jour; le service est ensuite vérifié sur le
port 3045 avec retour automatique à la version précédente en cas d’échec.
