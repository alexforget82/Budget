# Vérifications — 0.1.0

44 tests Node passent, sans échec ni omission dans cet environnement. Ils portent sur le moteur pur, les services SQLite, l’API HTTP, les contrôles d’accès privé et l’installation.

Le cas 1 000 $ / limite de 230 $ / achat sur carte de 71,69 $ conserve 770 $. Les tests couvrent les renouvellements successifs, l’imputation anticipée, paiements partiels/complets/excédentaires, achat hors limite, factures en retard, paies reçues et à recevoir, contrôle de solde par ordre de saisie, historique déjà inclus, sauvegardes/restauration et import répétable avec conflits. L’identité privée et le lien de lecture sont testés avec des en-têtes Tailscale simulés.

Un test exécute le vrai code Sillage sur une base temporaire fictive et compare 30 journées plus les deux indicateurs. Le scénario correspond à une enveloppe renouvelée automatiquement, sans avance manuelle; il produit les mêmes valeurs. Des alimentations anticipées de Sillage ont également révélé des écarts de période pendant le développement : le rapport les conserve comme non classés jusqu’à explication, sans ajuster le nouveau moteur pour masquer une différence.

`tests/ui.py` configure une vraie base temporaire depuis l’interface, ajoute une carte, saisit l’achat de référence, vérifie le partage et importe un CSV historique. Les trois écrans sont vérifiés à 320, 390, 430, 768 et 1440 pixels, en clair et en sombre, sans débordement horizontal. Les trois maquettes sont capturées sur ordinateur et iPhone. Les chiffres de toutes les captures sont fictifs.

L’installateur utilise un gestionnaire systemd simulé dans les tests. Le vrai `systemd-analyze verify` accepte ses chemins, y compris espaces, pourcent et dollar. Une copie réellement installée démarre aussi un serveur sur sa propre base SQLite et charge sa migration numérotée. Le test d’échec rétablit le code précédent et conserve données et copie de sécurité. Un fichier sentinelle dans un dossier Sillage distinct reste identique.

Aucun test physique sur Chromebook ou Safari iOS, aucune migration de données personnelles et aucun essai réel de deux à quatre semaines n’est présenté comme accompli. Les règles source non reprises gardent le disponible importé provisoire. [Résultats structurés](checks.json).

L’archive autonome extraite a également passé `npm test` : 43 tests réussis et un test de référence Sillage omis, car ce programme externe n’est pas livré dans la nouvelle archive. La comparaison pure et ses contrôles de classification restent testés. Le PDF des maquettes comporte trois pages.
