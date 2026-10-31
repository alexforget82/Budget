# Vérifications — 0.4.0

82 tests Node réussis, sans échec. Comparaison de 1 152 occurrences avec le calendrier du code Sillage, plus les listes de fériés 2026–2030. Les tests supplémentaires vérifient les défauts par intention, la date effective dans les prévisions, la simulation d’un achat sur compte/carte couvert ou hors limite sans écriture, le futur sans effet prématuré, et les soldes/points de contrôle secondaires exclus du disponible principal. Les 12 scénarios financiers figés restent identiques.

`tests/ui.py`, `tests/calendar-ui.py` et `tests/features-ui.py` passent sous Chromium. Le dernier vérifie le simulateur, le bilan, l’agenda avec déplacement visible, et la création/saisie du solde d’épargne, à 320/390/768/1440 pixels et en clair/sombre. Pas de validation physique Safari iOS. La vérification officielle Paiements Canada reste ouverte; HTTP 403, voir CALENDRIER.md.

L’archive autonome passe 80 tests; deux tests dépendant du programme Sillage externe sont omis, car ce programme n’est pas inclus dans l’archive indépendante.

## Référence précédente

# Vérifications — 0.3.0

74 tests Node réussis. Les nouveaux cas couvrent week-ends, jours fériés bancaires Québec/Canada, substitutions de Noël, années bissextiles, fin de mois calendaire et ouvrable, ancrage aux deux semaines et déplacements entre mois sans doublon. Les services vérifient les aperçus sans écriture, la conservation des échéances déjà payées et reports manuels, et le rejet atomique des ajustements invalides.

Le parcours supplémentaire `tests/calendar-ui.py` vérifie les choix dans l’assistant et le formulaire, leurs aperçus et leur sauvegarde aux largeurs 320, 390, 768 et 1440. Le parcours général Chromium passe aussi. Aucun test physique iOS n’est revendiqué. L’archive autonome passe 73 tests avec un seul test externe Sillage omis.

## Référence précédente

# Vérifications — 0.2.0, étape 1

63 tests Node passent, sans échec ni omission dans cet environnement. Douze scénarios figés depuis le tag 0.1.0 vérifient l’égalité exacte du disponible avant la paie, de sa date limite, des quatre lignes et des 30 premières journées. La nouvelle prévision couvre 90 jours sans étendre la fenêtre de dépense principale au-delà de son plafond existant de 30 jours.

Une facture au 12 janvier, hors des 30 premiers jours, modifie le minimum sur 90 jours et son motif sans modifier le disponible avant la paie. Les tests vérifient aussi une paie distante, les renouvellements successifs et la somme exacte du détail des limites, les achats anticipés, le coussin Autres appliqué aux achats non limités sur banque et sur carte, l’exclusion des factures associées et des revenus, ainsi que la conservation du coussin dans une sauvegarde restaurée. Autres n’est pas activé silencieusement pour les anciens budgets; lui fixer une limite réutilise sa catégorie existante.

Le test exécutant le vrai code Sillage sur une copie SQLite fictive compare désormais 90 journées et les deux indicateurs. Aucune erreur n’est attribuée automatiquement à un moteur. Les différences sans justification empêchent toujours de valider une bascule.

Le parcours Playwright/Chromium couvre les trois écrans, cinq largeurs et les deux apparences émulées. Il vérifie le coussin proposé dans l’assistant, l’ouverture du détail tactile, son total, l’alerte nommant une facture lointaine, la vue partagée, l’import CSV et le changement automatique de thème lorsque la préférence de l’appareil change. Une ancienne préférence manuelle stockée ne prend plus le dessus. Captures fictives dans `step1/`.

L’archive extraite passe aussi 62 tests, avec le seul test externe Sillage omis lorsque le programme source n’est pas disponible à côté de l’archive. Les contrôles systemd et la copie réellement installée restent validés. Aucun test physique Chromebook ou Safari iOS ni aucune migration de finances personnelles n’est présenté comme réalisé. [Résultats](checks.json).

## Référence 0.1.0

# Vérifications — 0.1.0

44 tests Node passent, sans échec ni omission dans cet environnement. Ils portent sur le moteur pur, les services SQLite, l’API HTTP, les contrôles d’accès privé et l’installation.

Le cas 1 000 $ / limite de 230 $ / achat sur carte de 71,69 $ conserve 770 $. Les tests couvrent les renouvellements successifs, l’imputation anticipée, paiements partiels/complets/excédentaires, achat hors limite, factures en retard, paies reçues et à recevoir, contrôle de solde par ordre de saisie, historique déjà inclus, sauvegardes/restauration et import répétable avec conflits. L’identité privée et le lien de lecture sont testés avec des en-têtes Tailscale simulés.

Un test exécute le vrai code Sillage sur une base temporaire fictive et compare 30 journées plus les deux indicateurs. Le scénario correspond à une enveloppe renouvelée automatiquement, sans avance manuelle; il produit les mêmes valeurs. Des alimentations anticipées de Sillage ont également révélé des écarts de période pendant le développement : le rapport les conserve comme non classés jusqu’à explication, sans ajuster le nouveau moteur pour masquer une différence.

`tests/ui.py` configure une vraie base temporaire depuis l’interface, ajoute une carte, saisit l’achat de référence, vérifie le partage et importe un CSV historique. Les trois écrans sont vérifiés à 320, 390, 430, 768 et 1440 pixels, en clair et en sombre, sans débordement horizontal. Les trois maquettes sont capturées sur ordinateur et iPhone. Les chiffres de toutes les captures sont fictifs.

L’installateur utilise un gestionnaire systemd simulé dans les tests. Le vrai `systemd-analyze verify` accepte ses chemins, y compris espaces, pourcent et dollar. Une copie réellement installée démarre aussi un serveur sur sa propre base SQLite et charge sa migration numérotée. Le test d’échec rétablit le code précédent et conserve données et copie de sécurité. Un fichier sentinelle dans un dossier Sillage distinct reste identique.

Aucun test physique sur Chromebook ou Safari iOS, aucune migration de données personnelles et aucun essai réel de deux à quatre semaines n’est présenté comme accompli. Les règles source non reprises gardent le disponible importé provisoire. [Résultats structurés](checks.json).

L’archive autonome extraite a également passé `npm test` : 43 tests réussis et un test de référence Sillage omis, car ce programme externe n’est pas livré dans la nouvelle archive. La comparaison pure et ses contrôles de classification restent testés. Le PDF des maquettes comporte trois pages.
