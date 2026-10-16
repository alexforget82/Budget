# Rapport de vérification — v2.1.0

Les tests ci-dessous ont été exécutés sur des copies temporaires du logiciel, jamais sur les données de l'utilisateur.

| Scénario | Résultat |
|---|---|
| Syntaxe de `server.js` et `app.js` (Node.js 22) | Réussi |
| Chargement API, 90 jours de prévision | Réussi |
| Création, modification et suppression de transaction (solde et enveloppe) | Réussi |
| Achat sur carte de crédit et paiement par virement, puis suppression | Réussi |
| Rapprochement manuel avec un montant réel différent de la récurrence | Réussi |
| Refus d'un rapprochement en doublon | Réussi |
| Déplacement d'une occurrence, puis annulation | Réussi |
| Refus de données invalides et absence de mutation | Réussi |
| Budget exceptionnel d'enveloppe, puis suppression de l'exception | Réussi |
| Migration depuis une base v1.8, conservation des comptes/enveloppes, sauvegarde préalable | Réussi |
| Simulation DOM dans Chromium : indicateurs STS, onglets, calendrier, prévision 90 jours, dialogues | Réussi, aucune erreur JS observée |
| Safari réel sur Mac | Non testé : validation utilisateur nécessaire |

**Limites des tests** : les scénarios automatisés ne couvrent pas tous les historiques de transactions, toutes les combinaisons de dates de récurrence ou toutes les migrations possibles. La simulation navigateur a utilisé des réponses API contrôlées. La vérification d'une copie réelle de vos données reste nécessaire avant toute utilisation quotidienne.


## Refonte visuelle — vérifications supplémentaires

Exécutées avec Node.js 24 et Chromium, sur une base temporaire :

- Données créées par les API réelles : comptes, enveloppe, récurrences et transaction.
- 30 points de graphique et 30 lignes dans le tableau; navigation clavier Début/Fin.
- Avertissement et points négatifs lorsque le disponible descend sous zéro.
- Budget constant à zéro et sections vides; ouverture des formulaires depuis leurs actions.
- Neuf écrans, raccourcis du tableau de bord et dialogues de saisie.
- Aucun débordement de page à 375, 390, 768, 1024 et 1440 pixels sur le tableau de bord; neuf écrans vérifiés à 390 et 1440 pixels.
- Préférences système sombre et réduction des animations.
- Erreur de validation API visible dans la fenêtre, puis enregistrement valide avec confirmation, fermeture et variation exacte de 500 cents du compte sélectionné.
- Aucune erreur JavaScript ou console inattendue. La réponse HTTP 400 de la saisie volontairement invalide est attendue.

Le test reproductible est `tests/ui-smoke.py`; prérequis dans le README. Les captures du README utilisent exclusivement des données fictives. Ces contrôles ne constituent pas une nouvelle validation exhaustive des calculs, migrations ou historiques bancaires. Safari réel reste non testé.
