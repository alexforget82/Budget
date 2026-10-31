# 0.4.1 — fermetures du système de paiement

Concordance exacte avec les tableaux 2026/2027 reçus de l’utilisateur. Retrait du 24 juin du calendrier national de traitement; les congés provinciaux et propres à un fournisseur ne sont pas des fermetures nationales. Conversion protégée des anciennes décisions d’échéance au démarrage/restauration et des décisions importées de Sillage, sans toucher aux transactions réelles. Sauvegarde cohérente avant une conversion effective. Les sources n’ont pas été consultées directement : contrôle du contenu transmis, pas authentification externe.

# 0.4.0 — dates visibles et outils quotidiens

Valeurs par défaut de déplacement selon le type de nouvelle récurrence, sans modifier les règles existantes. Dates nominales/effectives visibles. Simulateur d’achat utilisant la prévision et les limites, bilan réel par catégorie, agenda mensuel des échéances ouvertes et comptes d’épargne séparés du disponible principal. Comparaison des dates avec Sillage sur 1 152 cas et des listes de fériés 2026–2030. Validation officielle Paiements Canada en attente (accès HTTP 403). Aucun changement du schéma SQLite.

# 0.3.0 — calendrier des récurrences

Choix du jour ouvrable précédent/suivant ou de la date inchangée dans l’assistant et les formulaires. Dernier jour calendaire et dernier jour ouvrable du mois distincts. Aperçu des prochaines dates; conservation des échéances réglées et reports manuels lors des changements compatibles. Validation des ajustements et avertissement explicite pour les dates RRQ estimées. Aucun changement de schéma.

# Historique

## 0.2.0 — noyau, étape 1

Minimum et comparaison Sillage sur 90 jours, avec disponibilité avant la paie et plafond de sa fenêtre à 30 jours conservés. Alerte datée pour un creux supplémentaire au lieu d’un chiffre répété. Détail tactile des limites protégées, restant actuel et renouvellements nets des achats anticipés. Coussin Autres de 50 $/mois dans le nouvel assistant, modifiable et facultatif; les budgets existants ne sont pas modifiés. Une seule palette claire Laine et sapin et un mode sombre automatique selon l’appareil. Pas de changement de schéma ni des liens iPhone.

## 0.1.0 — première version d’essai

Nouveau programme indépendant : Aujourd’hui, Transactions, Plan; assistant en quatre étapes; limites hebdomadaires/mensuelles; achats anticipés; cartes sans suivi du solde; paiements et factures atomiques; points de contrôle par ordre de saisie; prévision limitée à 30 jours. Import CSV avec aperçu, identité Sillage persistante, rapport de comparaison sur copies temporaires. Deux thèmes, trois maquettes, lecture iPhone révocable et installation Chromebook distincte. La bascule des données réelles n’est pas validée automatiquement.
