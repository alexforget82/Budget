# Vérifications — 0.5.1

99 tests Node réussis. Nouveaux cas : date du solde principal déterminée par séquence, indépendance d’un point de contrôle d’épargne, statut de copie quotidienne égal à l’heure réelle du fichier, export sans mutation, et copie endommagée signalée sans date de succès. L’export de la base active reste disponible en cas d’échec de copie. Les contrôles SQLite sont mis en cache avec taille/date du fichier et réexécutés quand il change.

`tests/status-ui.py` vérifie le repère du solde, le téléchargement réel d’un JSON et son contenu exact, puis Payée et Reporter depuis le rappel. Le compteur disparaît une fois les retards traités. La vue partagée garde la date et l’indication des retards, sans actions de traitement ni lien d’export. 320/390/768/1440 pixels, clair/sombre, sans débordement horizontal. Parcours général et outils quotidiens également réussis. Captures fictives dans `status/`; aucun test matériel iOS revendiqué. Archive autonome : 97 tests réussis et deux références Sillage externes omises.

## Référence précédente

# Vérifications — 0.5.0

96 tests Node réussis. Nouveaux cas : correction de paiements de carte partiels/complets/excédentaires sans seconde déduction, suppression rétablissant les achats à payer, correction des virements d’épargne, conservation de l’ordre et des soldes bancaires vérifiés. La suppression d’un virement lié rouvre l’échéance; les modifications invalides sont refusées atomiquement.

L’API du simulateur partagé donne les mêmes décisions que la version propriétaire (achat non prévu/couvert, compte/carte et date). Elle renvoie seulement allowed/provisional, rejette les origines croisées, les dates/montants invalides et les liens révoqués. Les tables exportées restent identiques après les simulations. Les vérifications Tailscale avec en-têtes simulés confirment que la conjointe peut simuler via son lien, sans modifier un virement ni accéder à l’export.

`tests/daily-tools-ui.py` couvre modification/suppression avec confirmation, filtres accent/catégorie/compte et totaux, conservation des filtres après correction, limites exactes et simulateur partagé avec résultat simple/options. 320/390/768/1440 pixels, clair/sombre, sans débordement. Le parcours général passe aussi. Captures fictives dans `daily-tools/`; aucun test matériel iPhone revendiqué. Archive autonome : 94 tests réussis, deux références Sillage externes omises.

## Référence précédente

# Vérifications — 0.4.6

92 tests Node réussis. Nouveaux cas : dates RRQ novembre/décembre 2026, absence d’effet sur les autres règles de fin de mois, estimation janvier 2027 clairement distinguée, et prévision d’un seul versement le 30 décembre sans revenu additionnel le 31. Une base simulant 0.4.5 est rouverte : un revenu déjà reçu conserve sa transaction et sa date réelle, sa clé devient celle du 30 décembre, une sauvegarde précède le changement et la conversion est idempotente.

Parcours Chromium général et formulaires de calendrier vérifiés. Les données 2027 reçues sont une estimation selon la réponse explicite de l’utilisateur; aucune publication officielle RRQ n’est revendiquée comme consultée. Archive autonome : 90 tests réussis et deux références Sillage externes omises.

## Référence précédente

# Vérifications — 0.4.5

89 tests Node réussis. `tests/forecast-explorer-ui.py` compare chacun des 30 montants affichés aux journées retournées par le moteur, à 320/390/768/1440 pixels et en clair/sombre. Vérifie les détails Bell/Discord à leur date, les limites protégées, le saut au minimum, Home/End/flèches sur le curseur, la sélection directe sur la courbe et la conservation de l’alerte 90 jours pour une facture au-delà du graphique.

La lecture simplifiée affiche le même montant pour la même journée, sans boutons d’écriture. L’export des tables reste exactement identique après navigation. Les parcours généraux et outils quotidiens passent aussi. Captures fictives dans `forecast-explorer/`; pas de test matériel Safari iOS revendiqué. Archive autonome : 87 tests réussis et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.4.4

89 tests Node réussis; moteur financier inchangé. `tests/calendar-grid-ui.py` configure une vraie base temporaire fictive et compare les montants des cases avec les journées du moteur. Vérifie Mois/Liste, lundi comme premier jour, journées hors horizon sans montant, navigation aux bornes, retard et renouvellement de limite. La navigation laisse l’export des tables identique. Une facture future marquée Payée crée exactement une transaction à la date réelle d’aujourd’hui et conserve l’ouverture du calendrier et le mois sélectionné.

Quatre largeurs (320, 390, 768, 1440), clair/sombre, aucun débordement horizontal. Parcours général et tests des outils quotidiens également réussis. Captures fictives dans `calendar-grid/`. Aucun test physique iOS revendiqué. Archive autonome : 87 tests réussis et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.4.3

89 tests Node réussis. Interface générale à cinq largeurs et deux thèmes, ainsi que tutoriel mobile vérifiés sous Chromium. Contrastes des paires principales texte/surface, texte secondaire/surface, accent/fond et texte du disponible/fond du disponible : tous supérieurs à 4,5:1 dans les deux thèmes; ce contrôle ne constitue pas un audit complet d’accessibilité.

Vérification HTTP réelle du PNG (signature et Content-Type), de son lien dans le manifeste et de la présence apple-touch-icon. Les liens de lecture conservent leurs manifestes propres et l’accès public au seul fichier de logo. Le lanceur Linux utilise désormais le PNG. Pas de test physique d’installation du raccourci Safari iOS revendiqué; une ancienne icône peut nécessiter de recréer le raccourci.

Captures à chiffres fictifs dans `identity/`. Archive autonome : 87 tests réussis, deux références Sillage externes omises.

## Référence précédente

# Vérifications — 0.4.2

89 tests Node réussis; calculs et calendrier inchangés. Le parcours général Chromium et `tests/tutorial-ui.py` passent. Le nouveau parcours vérifie l’affichage automatique aux quatre étapes, la conservation d’un solde saisi après masquage/réaffichage, la configuration complète et la relecture depuis Aujourd’hui/Plan. Navigation précédent/suivant, sortie anticipée et fin du tutoriel laissent les tables de données exactement identiques. Vérifications à 320/390/768/1440 pixels, clair et sombre, sans débordement horizontal. Aucune validation physique Safari iOS revendiquée.

Archive autonome : 87 tests réussis, deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.4.1

89 tests Node réussis. Concordance exacte, sans fermeture supplémentaire, avec les tableaux 2026 et 2027 fournis par l’utilisateur. Vérifications des jours provinciaux/sectoriels exclus, de Noël/lendemain et de la frontière janvier 2028. Aucun téléchargement source réussi n’est revendiqué.

Les tests SQLite ouvrent une base simulant l’ancien calendrier, convertissent les clés des échéances sans réécrire les achats, vérifient la sauvegarde automatique avant changement et l’idempotence. Une restauration conserve un report manuel et son montant; un conflit de clé est refusé. La compatibilité historique continue de correspondre à Sillage sur 1 152 occurrences; le calendrier national diffère volontairement par juin.

Les parcours Chromium restent vérifiés : interface générale, formulaires de dates et nouveaux outils. Les tests à date réelle choisissent explicitement l’absence de déplacement pour leur paie fictive « demain »; les valeurs par défaut sont testées séparément, ce qui évite une dépendance au jour de la semaine. Pas de test matériel iOS/Chromebook revendiqué.

Archive autonome : 87 tests réussis et deux références externes Sillage omises.

## Référence précédente

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
