# Vérifications — 1.3.0

**157 tests Node réussis**. Le moteur, les limites, les cartes, les règles de classement et l’import CSV donnent les mêmes résultats. Les parcours Chromium `classification-ui.py`, `daily-tools-ui.py` et `ui.py` ont été exécutés sur des données fictives. Ils valident la file de révision, le total et la moyenne de la sélection, le tri alphabétique, les filtres, les virements, l’import CSV et l’affichage mobile sur quatre largeurs et deux thèmes. Aucune donnée réelle n’est utilisée. Cette version ne modifie aucune table ni formule financière.

## Référence précédente

# Vérifications — 1.2.0

**157 tests Node réussis**. Neuf nouveaux scénarios couvrent les revenus échus et leur confirmation sans double ajout au solde, les suggestions sans mutation, la confirmation explicite d’un push par envoi, les versions numériques, la source et l’archive fixes, cache quotidien/concurrence, absence de réseau, réponses invalides et préférences sans effet financier.

**Interface** : les 18 parcours Chromium passent, dont `usability-ui.py` (revenu nouveau ou déjà inclus, commerçant récent, priorité manuelle, période anticipée, mise à jour guidée et vue partagée) et `notifications-ui.py` (réception déclarée, permissions et réglages simulés). Contrôles mobiles à quatre largeurs et deux thèmes. Les tests désactivent les vérifications réseau automatiques; aucun budget réel utilisé.

Le moteur financier n’est pas modifié. Les notifications nécessitent encore un test sur l’iPhone physique et l’observation des résumés de 7 h; une acceptation technique ne garantit pas leur affichage.

# Vérifications — 1.1.0

**148 tests Node réussis** : les 139 précédents et neuf scénarios supplémentaires. Chiffrement authentifié et déchiffrement récepteur, signature/audience/expiration VAPID, destinations/redirects/TTL, 7 h été/hiver, réservation persistante et concurrence, trois reprises maximum/expiration, scope propriétaire/adresse et suspension, confidentialité et seuil 79/80/85 %, corruption locale sans effet financier, service worker sans fetch et clic local, API privée/permissions/JSON financier inchangé/effacement suspendant les rappels. Aucun message réel envoyé par les tests.

**Interface** : `notifications-ui.py` vérifie le geste d’autorisation, l’activation, les détails masqués par défaut, le test, les préférences, la désactivation, la suspension globale, les instructions iPhone écran d’accueil et l’absence de commandes dans la vue partagée. Quatre largeurs et deux thèmes, APIs de notifications/navigateur simulées. Parcours général, finition mobile et minimum 30 jours également réussis. Les APIs simulées ne valident pas une livraison Apple ni un iPhone physique.

**Interopérabilité indépendante** : `tests/push-interop.js` a déchiffré notre payload avec http_ece issu de web-push 3.6.7, installé séparément dans un dossier de développement temporaire. Cette bibliothèque et ses dépendances ne sont pas livrées, ne sont pas nécessaires au programme et n’ont envoyé aucun push. Reproduction facultative : `node tests/push-interop.js /chemin/developpement/package.json`.

**Récupération** : programmes réels 0.9.0 → 1.1.0 → 0.9.0 et restauration JSON par API réussis sur budget fictif, mêmes prévisions et tables. Commandes systemd simulées comme décrit précédemment. Le lien simplifié est conservé. Aucun changement de schéma ou moteur.

**À confirmer par l’utilisateur** : installation sur l’appareil, autorisation iOS et réception via Envoyer un test, puis envoi du matin avec serveur éveillé. La livraison peut être retardée par le réseau ou Concentration. Archive autonome : 146 tests Node réussis et deux références externes Sillage omises. Tests sur données fictives, aucune ouverture en écriture d’une vraie base.

## Référence précédente

# Vérifications — 1.0.0

**139 tests Node réussis**, zéro échec. Les 137 scénarios précédents conservent leurs résultats. Deux tests de récupération supplémentaires exercent un échec de démarrage après une vraie migration SQLite (programme, données et configuration d’origine rétablis, copie échouée gardée), puis le retour explicite avec refus sans confirmation, sauvegarde du budget récent, échec réversible et réussite persistante.

**16 parcours Chromium réussis** : assistant, tutoriel, interface générale, calendrier, grille mensuelle, budget, graphique quotidien, outils courants, états/sauvegardes, exceptions ponctuelles, suppression du plan, minimum 30 jours, reports hebdomadaires, deux fois par mois, classement/révision et finition 1.0.0. Petits/grands écrans et thèmes clair/sombre. `tests/release-ui.py` vérifie la version sans mention d’essai, les contrôles de 16 px et boutons de 44 px, la fermeture accessible en hauteur réduite, le guide et la parité partagée sans écriture.

**Programmes réels et restauration** : `python3 tests/recovery-integration.py`, depuis le dépôt contenant l’archive 0.9.0, lance les deux programmes et leurs API HTTP sur une base fictive. Compare l’export complet et la simulation avant/après mise à jour, crée une opération, restaure réellement le JSON par l’API, vérifie l’identité des tables/prévisions, puis revient à la 0.9.0 avec le lien simplifié intact et le budget récent conservé. Les commandes systemd y sont simulées, les serveurs Node et SQLite sont réels. Ce script indique SKIP dans une livraison autonome sans l’ancienne archive.

**Export figé fourni** : le fichier du 1 novembre 2026 a été recalculé hors dépôt sur une copie; 90 journées comparées à un grand livre indépendant, sans écart, et mêmes résultats financiers entre la 0.9.0 et la 1.0.0. Ce contrôle ne porte pas sur les réglages que l’utilisateur a modifiés après cet export. Aucun fichier personnel ou lien réel n’est livré.

**Limites de validation** : pas de test matériel ChromeOS/iPhone; pas de deux semaines d’usage réel terminées. Ces étapes restent une validation utilisateur à faire. Les tests système utilisent des dossiers isolés; Sillage et les vraies bases ne sont jamais ouverts en écriture. Archive autonome : 137 réussites Node et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.9.0

137 tests Node réussis. Nouvelles vérifications : normalisation avec conservation des chiffres significatifs, opérateurs/priorité/conditions, exclusion des échéances payées, parité financière après création/pause/suppression de règle et validation, mémorisation atomique, CSV proposé et remplacement explicite, aperçu de classement en lot/jeton périmé/préservation banque-carte-soldes, JSON 3 et restauration JSON 2, migration réelle du schéma 2 avec copie originale intacte. Migration depuis le schéma 1 et JSON 1 également conservée dans les tests existants. Routes privées de classement/révision refusées à l’utilisateur partagé.

`tests/classification-ui.py` : règles depuis l’interface, proposition manuelle remplaçable, mémorisation, CSV avec catégories par ligne, file et compteur de révision, validation par règle, classement en lot avec confirmation d’effet, pause/suppression sans effet financier, parité du lien simplifié; 320/390/768/1440 et deux thèmes sans débordement. Parcours général, outils quotidiens et minimum sur 30 jours également réussis. Données fictives seulement; aucun test matériel iPhone revendiqué. Archive autonome : 135 réussites et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.8.0

130 tests Node réussis. Six nouveaux scénarios : exactement 24 allocations annuelles, février bissextile et fin de mois; protection des deux périodes, achats anticipés banque/carte et paiement sans deuxième déduction; deux dates de facture, jours fériés et refus des dates déplacées trop proches; aperçu, montant exceptionnel et remappage d’un état sauvegardé; budget mensuel et restauration des seconds jours; migration d’une vraie base SQLite schéma 1 avec copie intacte, références et lien privé conservés, restauration JSON ancien format.

`tests/semimonthly-ui.py` : assistant initial et éditeurs de limite/facture, second jour sauvegardé, aperçu, deux allocations/deux factures au budget, choix de période anticipée, parité propriétaire/partage, quatre largeurs et deux thèmes. Parcours général, calendrier et exceptions ponctuelles également réussis. Données fictives seulement; pas de test matériel iPhone revendiqué. Archive autonome : 128 tests réussis et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.7.2

124 tests Node réussis. Retrait d’une limite après achat sur carte : catégorie et transaction conservées, protection de carte intacte, limite retirée du disponible et rattachement Autres nettoyé. Retrait d’une facture après paiement : transaction, lien d’échéance et solde vérifié inchangés; échéances futures retirées; marqueur conservé après sauvegarde/restauration; identifiant invalide refusé.

`tests/remove-plan-ui.py` utilise une base fictive : actions dans liste/éditeur, confirmation et annulation, mise à jour immédiate et persistante de Plan, recalcul de prévision, historique conservé et absence de débordement à 320/390/768/1440 pixels. Vérifie aussi les écrans propriétaire/partagé en clair/sombre. Archive autonome : 122 tests réussis, deux références externes Sillage omises. Aucun test matériel iPhone revendiqué.

## Référence précédente

# Vérifications — 0.7.1

122 tests Node réussis. Nouveaux tests : première facture avancée avant son début nominal (compte bancaire et carte, retard, report avec montant exceptionnel, payée/annulée); calendrier indépendant des protections sur 90 jours pour chaque jour de renouvellement hebdomadaire, avec/sans reports et limite mensuelle; petit revenu avant grosse facture, minimum 30 jours distinct du disponible avant revenu, égalité des quatre lignes, achats banque/carte et remboursement de carte sans double déduction.

`tests/spending-window-ui.py` : minimum 30 jours prioritaire, montant avant revenu secondaire, détail des limites cohérent, parité propriétaire/partage pour chacune des 30 dates au curseur, absence d’écriture, quatre largeurs et deux thèmes. Parcours général et reports hebdomadaires également vérifiés. Tests sur données fictives; pas de validation matérielle iPhone. Archive autonome : 120 réussites, deux références externes Sillage omises.

Un export fourni a été recalculé hors dépôt, sur une copie : comparaison des 90 lignes avec un grand livre indépendant. Aucune donnée personnelle ni lien privé n’est livré dans l’archive ou les tests.

## Référence précédente

# Vérifications — 0.7.0

119 tests Node réussis, aucun échec. Neuf nouveaux tests couvrent les mois à deux/trois paies et quatre/cinq allocations, dates déplacées, exceptions, échéances payées/annulées, remboursement et paiement de carte sans double compte, reports séparés, fréquences longues et validation des mois. L’API de budget est réservée au propriétaire et sa lecture ne modifie ni les tables ni la simulation.

`tests/budget-ui.py` vérifie les totaux mensuels, changement de mois, écart négatif, report séparé, classement facultatif, absence de champs de montants éditables et de mutations. Quatre largeurs (320/390/768/1440), deux thèmes, sans débordement horizontal. Captures fictives dans `budget/`. Parcours général, calendrier et outils quotidiens également réussis. Aucun test matériel iPhone revendiqué. Archive autonome : 117 tests réussis et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.6.0

110 tests Node réussis. Huit nouveaux scénarios : 230−180 puis report 50 et budget 280; premier jour du mois sans reset prématuré; premier renouvellement avec allocation entière; février bissextile, quatre/cinq renouvellements et changement d’année; dépenses sur carte et simulation d’achat sans deuxième protection; achats anticipés y compris au-dessus de leur allocation, sans report emprunté entre mois; dépassements/remboursements bornés; activation non rétroactive, nouvelles catégories et restauration de la date d’activation. Le détail des protections égale toujours le total, les allocations futures restent protégées sans anticiper une non-dépense.

`tests/weekly-rollover-ui.py` utilise une base fictive et une horloge de serveur isolée au test. Vérifie le budget 280/report 50 le 8 avril, le maintien du report au 1er mai avant renouvellement, puis 230 sans report au 6 mai. Même résultat dans la vue partagée et le simulateur, sans écriture de navigation. Quatre largeurs, clair/sombre; captures de limites fictives dans `weekly-rollover/`. Parcours général et outils quotidiens réussis. Aucun test matériel iOS ou données personnelles utilisé.

Les 12 scénarios historiques figés vérifient le mode sans reports; la nouvelle règle est un changement volontaire distinct de Sillage. Archive autonome : 108 tests réussis et deux références externes Sillage omises.

## Référence précédente

# Vérifications — 0.5.2

102 tests Node réussis. Nouveaux scénarios : revenu unique ajusté sans toucher à la paie suivante, dépense unique avec report/reset de montant et refus atomique de valeurs invalides, dépense sur carte protégée une fois. La saisie réelle utilise le montant modifié sans seconde déduction; aucune transaction avant confirmation, et une échéance déjà réglée refuse la modification de prévision.

`tests/oneoff-ui.py` couvre revenu/dépense, échéance suivante inchangée, reset, date reportée conservée, accès depuis le calendrier et formulaire du paiement réel créant une seule transaction. Quatre largeurs et deux thèmes, sans débordement. La vue partagée ne propose pas ces actions. Parcours général et rappel des retards vérifiés également. Captures fictives dans `oneoff/`; pas de test matériel iPhone revendiqué. Archive autonome : 100 tests réussis, deux références externes Sillage omises.

## Référence précédente

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
