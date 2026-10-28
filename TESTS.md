## 16.0.1 — service Linux et sélection des données

134 tests Node et 201 tests API passent. Les huit tests Linux incluent le vrai `systemd-analyze verify` : ancien WorkingDirectory entre guillemets refusé, nouveau service accepté pour un chemin simple ou avec espaces et spécificateurs, chemins avec retour à la ligne refusés. Le cas de deux bases manuelles v15/v16 exige une sélection explicite. Les tests de conservation des données, sauvegarde, restauration du service et reprise après migration échouée restent verts.

`linux-installed.py` redémarre une copie sur une vraie base SQLite temporaire et vérifie soldes, prévisions et toutes les tables. `installed-assets-ui.py` et `sillage-two-ui.py` passent pour les fichiers installés et le parcours de saisie. Aucun nouveau test sur Chromebook physique ni gestionnaire systemd utilisateur complet dans cet environnement. [Résultats](docs/v1601/checks.json), [réparation](docs/SILLAGE-2.0.1.md).

## Sillage 2 — version technique 16.0.0

132 tests Node et 201 tests API passent. La campagne Python initiale a passé 74 scripts sur 81. Les sept scripts concernés ont été repris : nouvelle navigation et intitulés, guide déplacé dans Réglages, menus latéraux devant rester fermés sur iPhone. Les assertions financières sont conservées; après correction et reprise, les 81 scripts sont validés. Le test de saisie et les workflows ont été relancés après les dernières retouches.

`sillage-two-ui.py` vérifie quatre pages principales et quatre onglets mobiles, les réglages détaillés, les contrôles de date progressifs, cinq largeurs/deux thèmes et une dépense couverte par une enveloppe : débit bancaire et réserve diminuent du même montant, disponible inchangé. Les comparaisons de navigation conservent prévisions et tables. `linux-installed.py` démarre une vraie copie de l’application sur la base SQLite copiée et compare toutes les tables, les soldes et la prévision. Six tests Node Linux vérifient installation, sélection des données, sauvegarde et retour au service précédent après échec, y compris une migration de la v15. Les appels systemd sont simulés; aucun Chromebook physique n’a été utilisé.

[Résultats détaillés](docs/sillage2/checks.json) · [Guide et installation](docs/SILLAGE-2.md). Les captures utilisent des données fictives.

## v15.0.0 — parcours regroupé, récurrences et prévisions

126 tests Node et 201 tests API passent. La campagne Python a passé 73 scripts sur 79 au premier lancement. Les six échecs ont été repris après correction : sélecteur d’enveloppe devenu ambigu, sous-catégories trop larges sur tablette, nouveau titre parent Budget attendu dans le test de navigation, débordement des récurrences sur iPhone et actualisation du Bilan lorsque sa page est regroupée sous Budget. Les assertions de montants ont été conservées. Les six scripts concernés passent après correction; les tests du registre, des prévisions et du parcours mobile ont aussi été relancés après les dernières retouches.

`workspace-flow-ui.py` contrôle les onglets, le panneau de paie, les montants d’enveloppe, les récurrences liste/calendrier, le tableau quotidien 30/60/90, les repères du graphique, Ctrl+K et la protection des saisies, le balayage horizontal et l’absence d’action lors d’un défilement vertical, l’action +, les liens directs, cinq largeurs et deux thèmes. Il compare prévisions, disponible, réserves et tables financières avant/après navigation. Les captures de tests vont dans un dossier temporaire par défaut; `SILLAGE_CAPTURE_DIR=docs/v150` permet de régénérer volontairement les références fictives sans écraser celles d’une ancienne version.

[Guide](docs/SILLAGE-15.0.md) · [Résultats](docs/v150/checks.json)

## v14.5.0 — budget en tableau et statistiques du registre

126 tests Node et 201 tests API passent. Les 78 scripts Python passent après reprise des trois échecs initiaux : décalage de bouton lors du focus dans Budget, versions serveur/interface différentes pendant une exécution et mise en page iPhone (mois puis montant très long). Les scénarios concernés ont été relancés; le registre et les scénarios de budget, sous-catégories et calendrier ont également été vérifiés après les corrections. Les assertions financières sont conservées; les tests ouvrent désormais les réglages par le nom de la catégorie ou le menu Options.

Le nouveau test `tests/register-budget-ui.py` vérifie les totaux sur 55 résultats/50 lignes, le total signé et la moyenne des sélections, l’enregistrement direct mensuel et la conservation du disponible, des soldes et des réserves. Vérifications aux largeurs 390/768/1100/1440; tests existants sur iPhone 320 à 760, neuf vues et deux thèmes, dont un montant de dix millions. [Résultats détaillés](docs/v145/checks.json), [guide](docs/SILLAGE-14.5.md). Les captures utilisent uniquement des données fictives.

# Vérifications de Sillage

## v14.4.0 — registre compact et classement rapide

**126 tests Node, 201 tests API historiques et 77 scripts Python validés.** Le passage complet Python donne 75/77. categories-v46-ui et workflows-ui ouvrent maintenant le menu ⋯ avant Modifier, puis passent à la relance. Les assertions de soldes, changements de signe, sous-catégories, archivage, import et restauration sont conservées. Le contrôle d’alignement de compact-register-ui utilise les noms des colonnes plutôt que leurs anciens indices, sans diminuer les exigences de densité ou de parité financière.

`register-v144-ui.py` crée 80 opérations et vérifie les neuf colonnes alignées, l’en-tête fixe après défilement, 50 lignes puis 30 sur la deuxième page, la sélection de page, le tri global et le filtre d’enveloppe. Il parcourt 320, 390, 768, 1100, 1440 et 1920 pixels dans les deux thèmes. Les lignes restent sous 62 pixels sur ordinateur et sous 78 en présentation compacte à deux lignes. La consultation conserve exactement les tables financières et la prévision.

Le même parcours modifie catégorie et sous-catégorie depuis une cellule, vérifie l’absence d’effet sur le disponible et la prévision, et conserve la deuxième page. Il vérifie le repère d’association issu du moteur, l’avertissement sur une association automatique lors d’un changement d’enveloppe, l’aperçu sans écriture, l’invalidation après changement de champ ou mutation concurrente, la confirmation explicite, le compte/date/montant conservés, le retour d’enregistrement et l’accès au classement et à l’éditeur complet sur téléphone. Fermer un aperçu ne modifie rien. Le parcours est relancé après les derniers ajustements.

`register-v144-api.py` utilise 65 opérations : filtre d’enveloppe portant sur 60 résultats au-delà de la première page, pagination sans doublon, tri par enveloppe dans les deux sens, export CSV de la totalité des résultats filtrés et absence de mutation des tables ou prévisions. Les protections du traitement de modification en lot restent vérifiées par les tests existants.

[Guide et captures](docs/SILLAGE-14.4.md) · [Résultats](docs/v144/checks.json). Aucun moteur financier ni schéma modifié; les mutations de classement réutilisent les traitements existants. Essais avec données fictives sous Chromium; aucun essai sur Safari réel ou iPhone physique.


## v14.3.0 — historique du minimum et rapprochement

**126 tests Node, 201 tests API historiques et 75 scripts Python validés.** Le passage complet Python donne 71/75. Quatre parcours sont corrigés ou adaptés puis relancés : budget-v43-ui conserve le libellé explicite du prochain budget; budget-v73-ui vérifie la réserve dans son nouveau détail et garde ses assertions financières; entry-phase1-ui passe après correction d’un vol de focus différé reproduit indépendamment; visual-v14-ui garde sa limite de hauteur après réduction des marges du nouveau résumé. Aucune assertion financière n’est retirée.

Les six tests `confidence-history.test.js` vérifient la somme exacte des trois composantes, le point d’ouverture, le changement de date du minimum, une date entrant dans l’horizon, la distinction 30/60/90, les clés composites, la persistance et la rétention, l’absence de doublon sur lecture identique, la réinitialisation et les pannes, ainsi que les signes banque/carte des pistes de rapprochement.

`confidence-v143-api.py` vérifie l’absence de mutation financière sur consultation, simulation ou comparaison, la concordance du journal avec les centimes canoniques, le redémarrage, l’interdiction HTTP du fichier privé, les paires et échéances, et le nouveau point de départ après restauration ou effacement complet. Les nouveaux tests unitaires et API sont relancés après l’isolation des erreurs de stockage du journal.

`confidence-v143-ui.py` vérifie le dialogue 30/60/90, le détail chiffré et la conservation d’un champ déjà choisi après ouverture, Budget/Dépensé/Restant, la réserve repliée, les étapes de rapprochement, les paires et la reprise après erreur. Les parcours couvrent 320, 390, 768 et 1440 pixels, deux thèmes, le débordement des dialogues et la stricte conservation des tables financières et de la prévision. Le nouveau parcours est relancé après les derniers ajustements. La copie installée et les parcours historiques de cartes, périodes, partage, restauration, clavier et menus restent validés.

Le défaut de focus est reproduit avec un scénario déterministe : ouvrir la saisie, choisir Description avant la prochaine frame, attendre cette frame; le champ perdait le focus avant correction et le conserve après. Le préremplissage historique est ensuite relancé sans diminuer ses exigences.

[Guide et captures](docs/SILLAGE-14.3.md) · [Résultats](docs/v143/checks.json). Aucun moteur financier ni schéma modifié. Journal local indépendant, initialisé dans cette version et remis à zéro après restauration ou effacement. Données fictives et Chromium; aucun essai sur Safari réel ou iPhone physique.


## v14.1.0 — contrôles et corrections ciblées

**120 tests Node, 201 tests API historiques et 73 scripts Python validés.** Le passage complet Python donne 69/73. Quatre parcours sont adaptés puis relancés avec succès : entry-phase1-ui attend les options d’enveloppes après rechargement avant d’exercer le préremplissage; responsive-v501-ui ouvre Outils seulement si fermé; sillage-v10-ui ouvre Plus avant Scénarios; ui-smoke attend le contrôle replié avant de l’ouvrir par Plus. Les assertions financières, de classement et de navigation restent actives.

`precision-calendar.test.js` vérifie le refus des fractions de cent (1.005, 10.005, notation scientifique), les montants valides, le CSV, les jours observés de Noël sans collision, le 30 septembre et le 11 novembre, le dernier jour ouvrable et les dates fixes non ajustées. `entry-integrity-api.py` reproduit un achat financé par Bien démarrer : changer sa description reste neutre; après correction de la règle et de l’achat de 100 à 90 dollars, la réserve n’est plus consommée à nouveau. Le test échoue avec l’ancien chemin de couverture. Les refus de précision sont vérifiés sans mutation des tables.

`dashboard-controls-ui.py` vérifie les menus, la fermeture et le focus avec Échap, les raccourcis recherche/jour par jour, la navigation détaillée, les déplacements des réglages après changement de largeur, les valeurs d’axe et extrêmes canoniques sur 30/60/90 jours, une courbe constante, quatre largeurs et deux thèmes. Les tables financières et prévisions restent identiques après navigation. Le parcours est relancé après les derniers ajustements. Les contrôles historiques v13/v14, contraste, installation, période d’enveloppe, cartes et partage passent aussi.

Avant les retouches du tableau de bord, la consolidation seule conserve les 27 propriétés calculées de chacun des 11 516 éléments visibles sur 36 vues (neuf écrans, deux thèmes, deux largeurs). Les feuilles actives passent de sept à quatre; 51 règles identiques et 63 définitions globales de palette remplacées sont retirées. Les fichiers de compatibilité restent servis et la copie installée exige le nouveau module de validation monétaire.

[Guide et captures](docs/SILLAGE-14.1.md) · [Résultats](docs/v141/checks.json) · [Relevé CSS](docs/v141/css-consolidation.json). Données fictives et Chromium pour les tests; aucun essai sur Safari réel ou iPhone physique. Aucune migration de base. Les trois corrections ont volontairement un effet sur les saisies, modifications et dates calculées concernées.


## v14.0.0 — présentation unifiée

**117 tests Node, 201 tests API historiques et 71 scripts Python validés.** Le passage complet Python donne 69/71; deux défauts d’affichage sont corrigés puis les parcours relancés : budget-v44-ui (l’ancienne grille de cartes provoquait un chevauchement lors de la sélection) et mobile-v115-ui (les totaux du registre repoussaient la première transaction sous le seuil de visibilité à 320 px). La suite npm complète passe après mise à jour du contrôle des sept feuilles de style installées. Le nouveau parcours v14 et le contrôle de contraste sont relancés après les derniers ajustements.

`visual-v14-ui.py` vérifie un registre de 45 achats, les montants canoniques, le calcul accessible sous un volet replié, les lignes d’enveloppes, les nombres entiers des totaux, six largeurs de 320 à 1920 px, deux thèmes et sept écrans, la vue partagée et l’absence d’écriture financière pendant la navigation. Le contraste texte/fond du document doit dépasser 7:1 dans chaque thème. Les contrôles de contraste historiques des catégories, boutons, en-têtes et dialogues passent aussi.

Le parcours v13 conserve sa couverture des horizons 30/60/90, des montants actuels et extrêmes, de neuf écrans sur huit largeurs, des réglages du tableau de bord et des enveloppes. Le contrôle iPhone historique couvre les zones tactiles, les feuilles de saisie, le clavier simulé, les menus, filtres et actions en lot. La copie installée charge les nouveaux fichiers sans erreur. Les tests historiques de transactions, cartes, réserves, périodes, partage et restauration restent actifs.

[Guide et captures](docs/SILLAGE-14.md) · [Résultats](docs/v14/checks.json). Bases fictives et Chromium uniquement : aucun essai sur Safari réel ou iPhone physique. Aucun moteur financier ni schéma modifié.

## v13.3.0 — phases 2 et 3 : période à la saisie et gestion simplifiée

**117 tests Node, 201 tests API historiques et 70 scripts Python validés.** Le passage Python complet donne 67/70. Les trois parcours corrigés sont relancés : budget-v43-ui (gestion via la fiche, options avancées et distinction prochain budget/réserve actuelle), budget-v44-ui (libellé Gérer) et card-envelope-protection-ui (champ Enveloppe désormais directement visible). Leurs assertions financières restent actives. La suite npm complète passe; le nouveau parcours UI est relancé après les derniers ajustements visuels.

`envelope-entry-api.py` compare une saisie avec période et l’ancien enregistrement suivi de l’association explicite, en restaurant une même base de départ : comptes, achats, enveloppes, liens et prévisions identiques sur banque et carte. Il vérifie aussi aperçu sans écriture, refus de choix périmé, date non proposée ou montant modifié, absence de sauvegarde partielle et comportement par défaut inchangé.

`envelope-entry-ui.py` couvre quatre largeurs de 320 à 1440 pixels dans les deux thèmes, choix avant sauvegarde, date réelle conservée, montant 158,31 $ restant sur 230 $, absence de deuxième demande d’association, formulaire courant/avancé, raccourci facture, masquage de l’alimentation en double, navigation sans écriture et refus puis nouvelle confirmation après modification sur un autre appareil. Les parcours historiques de vue partagée et de rapprochement passent aussi.

[Guide et captures](docs/SILLAGE-13.3.md) · [Résultats](docs/v133/checks.json). Bases temporaires fictives et Chromium uniquement; aucune validation sur iPhone physique ou Safari réel. Aucune modification de schéma ni des moteurs de calcul.

## v13.2.0 — phase 1 : saisie et classement des enveloppes

**117 tests Node, 201 tests API historiques et 68 scripts Python validés.** Le passage Python complet donne 64/68; les quatre parcours concernés sont corrigés puis relancés avec succès : budget-v44-ui (préremplissage devenu automatique), budget-v80-ui (message sans effet financier pour les anciennes actions), compact-register-ui (densité du registre) et transaction-transfers-ui (options de virement repliées). La suite npm complète passe après les dernières modifications.

Les nouveaux tests vérifient les noms normalisés, les ambiguïtés, les choix manuels et leur effacement, le CSV historique et réel, le refus des aperçus périmés, le filtre sur tout le registre, et la stricte parité de la modification en lot avec la modification unitaire sur une même base restaurée. Les achats sur carte et les associations de période sont couverts. Les aperçus et la navigation ne modifient pas les données financières. Le nouveau parcours UI couvre 320, 390 et 1440 pixels dans les deux thèmes; il est relancé après les derniers ajustements.

[Guide et captures](docs/SILLAGE-13.2.md) · [Résultats](docs/v132/checks.json). Bases fictives temporaires et Chromium uniquement; aucun essai sur iPhone physique ou Safari réel, ni accès aux finances de l’utilisateur.

## v13.1.2 — association aux périodes de budget protégé

114 tests Node et 201 tests API réussis. Nouveau parcours `reserved-period-match-ui.py` : achat bancaire de 71,69 $ associé au budget du lendemain, menus et fiche sur format iPhone, restant de 158,31 $ dans la vue partagée, date/transaction/comptes inchangés, période toujours ouverte, semaines suivantes intactes, absence de double association et refus de données périmées ou dates non proposées. Le même parcours vérifie l’achat sur carte : protection conservée jusqu’au remboursement, sans seconde charge ni modification de solde lors de l’association.

Les parcours `transaction-match-v111-ui.py`, `budget-v44-ui.py` et `shared-grocery-ui.py` passent également. La suite Python complète n’a pas été relancée pour ce correctif. Essais avec données fictives sous Chromium; aucun accès aux finances de l’utilisateur ni validation sur appareil iOS physique. [Guide](docs/CORRECTIF-13.1.2.md).

## v13.1.1 — première période d’enveloppe

114 tests Node réussis, dont le cas du 20/27 octobre sur compte bancaire et carte, en budget protégé et en paiement daté. Les tests historiques d’achats anticipés expriment maintenant explicitement l’association à la période future lorsqu’ils la supposent. Un nouveau parcours API vérifie la première période, les semaines suivantes, le redémarrage, l’absence de changements au grand livre, l’association volontaire et le renouvellement réel dû aujourd’hui. Le parcours API de paiement de carte et les parcours UI calendrier/épicerie sont également vérifiés. Les 201 tests de la suite API historique complète passent après clarification des cas d’achat anticipé volontaire. La suite Python complète n’est pas relancée pour ce correctif ciblé.

## v13.1.0 — paiement réel et confort iPhone

**113 tests Node, 201 tests API historiques et 64 scripts Python réussis.** Le premier passage complet Python donne 64/64. Le nouveau cas API vérifie aperçu sans écriture, paiement partiel, protection d’achat récurrent et d’enveloppe, dette non protégée, compte exclu, soldes réels, minimum projeté, reconnaissance d’un remboursement prévu unique, doublon, confirmation à usage unique et aperçu périmé. Les tests Node supplémentaires vérifient expiration, immutabilité du montant confirmé, données modifiées et échec d’écriture.

Le nouveau parcours UI couvre cinq largeurs et les deux thèmes, la présélection du Conjoint et du montant protégé, les modifications après aperçu, la confirmation avec données concurrentes, l’enregistrement d’un seul virement et l’avertissement de doublon. Des changements de visualViewport simulent le clavier et le zoom, sans prétendre tester le véritable iOS. L’API ciblée et le parcours UI sont relancés après les derniers ajustements du nouveau parcours.

[Guide et captures](docs/SILLAGE-13.1.md) · [Résultats](docs/v131/checks.json). Aucun changement de schéma. Les règles de protection existantes restent celles du moteur canonique. Les essais utilisent uniquement des bases fictives temporaires sous Chromium.

## v13.0.0 — refonte visuelle

**110 tests Node, 201 tests API et 62 parcours Python validés.** Le premier passage Python donne 57/62; les cinq échecs sont résolus et relancés : raccourci prochaine rentrée, densité des transactions sur petit écran, ouverture des options d’enveloppes dans le parcours historique, couleur sombre attendue et remplacement de l’ancienne exigence de styles identiques par la validation de la nouvelle présentation. Les assertions financières historiques restent actives. Le nouveau parcours v13 est relancé après les derniers ajustements.

Le parcours `visual-v13-ui.py` vérifie les montants actuels et les extrêmes des trois horizons contre l’état serveur, la décomposition sans double comptage des protections sur carte, huit largeurs de 320 à 1920 pixels et neuf écrans dans les deux thèmes. Il vérifie aussi recherche/filtres, édition des enveloppes, état après rafraîchissement, tableau de bord personnalisable, vue partagée et absence d’écritures financières pendant la navigation.

[Guide et captures](docs/SILLAGE-13.md) · [Relevé des résultats](docs/v13/checks.json). Les essais utilisent uniquement des bases temporaires fictives sous Chromium. Aucun essai sur iPhone physique ou Safari réel. Aucun changement du moteur financier ni du schéma de la base.


## Export ChatGPT — 11.4.3

**97 tests Node et 188 tests API réussis**, y compris les contrôles de confidentialité et d’accès de l’export. Le parcours `chatgpt-export-ui.py` passe sur ordinateur/iPhone, en clair/sombre, avec panne/reprise et téléchargement du contenu vérifié. La copie installée, la simulation du service et les 40 comparaisons historiques passent. La suite Python complète n’a pas été relancée. Voir [le guide et le relevé détaillé](docs/chatgpt-export-11.4.3.md).

## Vérification complémentaire des enveloppes

**95 tests Node et 186 tests API réussis**, sans nouveau changement du code applicatif v11.4.2. Les huit tests de `envelope-protection-matrix.test.js` couvrent 304 configurations. Voir la [vérification détaillée](docs/protection-periodes-11.4.2.md#vérification-complémentaire-de-tous-les-types-denveloppes).

## Correctif 11.4.2

**87 tests Node et 186 tests API réussis.** Sept nouveaux tests Node et trois tests API vérifient les réservations par période et l’absence de double comptage. La suite complète des scripts supplémentaires donne **55/56**; le test historique `categories-v46-ui.py` échoue de manière intermittente sur le rappel marchand, puis réussit à la relance ciblée, sans modification de ce test dans cette version. Le nouveau calendrier, les prévisions, l’installation, les sauvegardes, le retour au code précédent et les vues partagées passent.

[Explication du correctif et exemple du 28/29 octobre](docs/protection-periodes-11.4.2.md) · [Résultats détaillés avec l’échec et la relance](docs/protection-periodes-11.4.2-results.json). La comparaison historique utilise désormais une enveloppe avec report actif; le changement intentionnel du calcul sans report est vérifié dans les nouveaux tests.

## Correctif 11.4.1

80 tests Node et 183 tests API réussis. Le nouveau scénario `calendar-envelope-renewals-ui.py` reproduit d’abord le renouvellement invisible, puis vérifie trois semaines consécutives en largeur ordinateur et iPhone, sans changement des prévisions, soldes ni données. Les scénarios existants `planning-v4-ui.py`, `refactor-parity-ui.py` (40 combinaisons) et `installed-assets-ui.py` passent également. La suite complète des 56 scripts Python n’a pas été relancée pour ce correctif ciblé; le rapport complet ci-dessous concerne la v11.4.0.

Les essais utilisent des données fictives et des dossiers temporaires. Ils ne lisent pas les finances du Mac de l’utilisateur.

## Exécuter les contrôles

Node.js 22.13+ (Node 24 recommandé), Python 3, Playwright et Chromium sont nécessaires pour la totalité des vérifications. L’application elle-même ne nécessite aucun paquet npm.

```sh
npm test
python3 tests/run-python-checks.py --results /tmp/sillage-checks --jobs 2
```

Le premier lance les tests Node puis les tests API. Le second exécute chaque script Python supplémentaire, conserve chaque journal et renvoie un échec si un script échoue. Aucun test n’est ignoré automatiquement. `CHROMIUM_PATH` permet d’utiliser un Chromium installé sur la machine.

## Vérification de la v12.0.0

**110 tests Node, 201 tests API et 61 parcours Python validés.** La suite Python initiale donne 59/61 : le test de migration attendait une base sans le nouveau réglage d’activation; le test de budget libre pouvait modifier le budget avant réception de son aperçu. Après adaptations ciblées, les deux repassent, en conservant les assertions financières et la protection contre les aperçus périmés. Six parcours concernés ont été recontrôlés, ainsi que le chargement d’une interface dont la version diffère du serveur. Les [résultats](docs/v12-results.json) conservent l’exécution initiale et les recontrôles.

Les nouveaux tests couvrent Apple One à 53,98 $, achats réels/anticipés, association explicite de montant différent, annulation d’une occurrence, remboursements partiels/complets, absence de double réserve avec une enveloppe, dette ancienne exclue, changement/suppression de règle, modification/suppression de transaction, réutilisation d’identifiant, restauration, annulation et métadonnées de sauvegarde invalides. L’ancienne assertion qui laissait un achat récurrent sur carte sans protection est remplacée par la baisse du disponible à la date d’achat, avec solde bancaire inchangé et effet nul du remboursement sur la somme déjà protégée.

La lecture publique des versions est testée avec réponses contrôlées (nouvelle version, pas de mise à jour, manifeste invalide, erreur, taille excessive). La requête GitHub réelle n’a pas abouti dans cet environnement; elle renvoie une erreur sans interrompre le budget. Les essais d’iPhone restent des émulations Chromium; le [guide sur appareil](docs/IPHONE-12.md) décrit les vérifications Safari/iOS à faire après installation.

## Vérification de la v11.6.0

97 tests Node et 195 tests API réussis. La suite complète donne 59/60 scripts Python; le seul échec compare l’ancien tableau de bord avec le nouveau panneau de vérification ajouté. Après exclusion ciblée de ce nouveau panneau de la comparaison historique, le contrôle repasse : les 20 combinaisons de styles existants et les chiffres restent identiques. Le nouveau panneau et les aperçus sont couverts séparément par `confidence-v116-ui.py`, également repassé après les derniers ajustements mobiles. Les 60 parcours sont ainsi validés, sans modification des assertions financières. Les [résultats](docs/confiance-116-results.json) conservent l’exécution initiale et les recontrôles.

Le [guide](docs/confiance-11.6.md) décrit le calcul détaillé et l’aperçu des corrections. Les deux nouvelles vérifications API comparent le résultat théorique à une correction réelle sur données temporaires et contrôlent l’absence d’écriture pendant la comparaison.

## Vérification de la v11.5.2

97 tests Node et 193 tests API réussis. Le nouveau cas couvre une enveloppe avant sa première échéance et sans calendrier. Le parcours navigateur d’épicerie vérifie que la carte reste visible dans ces deux situations et disparaît après révocation; le parcours de simulation simplifiée reste vert.

## Vérification de la v11.5.1

97 tests Node et 192 tests API réussis. Quatre nouveaux cas API couvrent le suivi d’épicerie : absence/ambiguïté/inactivité, budget hebdomadaire, achats bancaires et sur carte, dépassement, report réel, exception de montant et achats associés à une autre période. Six parcours navigateur ciblés vérifient l’épicerie, la vue simplifiée existante, les périodes, les chiffres du propriétaire, la confidentialité et la comparaison financière avec la référence. Les autres résultats complets ci-dessous correspondent à la v11.5.0.

## Vérification de la v11.5.0

**97 tests Node, 188 tests API et 58 scripts Python réussis** sur données temporaires. La dernière exécution complète termine sans échec; ses [résultats détaillés](docs/iphone-115-results.json) sont conservés. Le parcours `mobile-v115-ui.py` vérifie cinq largeurs de téléphone en clair et sombre, neuf écrans, le retour sur ordinateur et une transaction enregistrée exactement une fois. Les tables financières et les prévisions restent identiques pendant la consultation. Le [guide mobile](docs/iphone-11.5.md) présente les captures et les limites des essais sur émulateur.

## Résultat final de la v11.4

**80 tests Node, 183 tests API et 55 scripts Python réussis.** La dernière exécution complète termine sans échec. Le [rapport de validation](docs/phases-2-5-validation.md) et les [résultats détaillés](docs/phases-2-5-results.json) conservent les preuves et les corrections apportées aux attentes des tests.

## Comparaison avant/après

`tests/refactor-parity-ui.py` extrait la référence v11.3 figée au commit `731a58b68532e67ac9f63e6765752db34ee32d9c`. La même base fictive est utilisée pour comparer les tables financières, les réserves et les prévisions de 90 jours. Il compare aussi les styles visibles de dix écrans, en clair et sombre, sur ordinateur à 1440 pixels : 20 combinaisons. La présentation téléphone, volontairement remaniée en v11.5, possède son propre parcours `mobile-v115-ui.py` : cinq largeurs, neuf écrans, deux thèmes, navigation, filtres, sélection multiple, saisie, clavier simulé et retour à la disposition ordinateur.

Les tests d’interface historiques ont été adaptés aux menus, dialogues et sections repliées de l’interface actuelle. Leurs assertions de montants, de persistance et d’absence d’écritures pendant la consultation sont conservées.

## Couverture de robustesse

- Migrations sur ancienne base, reprise après erreur, sauvegarde SQLite cohérente et restauration réelle avec redémarrage.
- Retour effectif au code v11.1, y compris une transaction créée après mise à jour.
- Installation simulée, démarrage/arrêt du service, copie complète des ressources et validation avant arrêt du service existant.
- Accès propriétaire et consultation limitée : identité Tailscale, hôte, absence de privilège par faux en-têtes, création/révocation et refus des jetons malformés.
- Corps JSON : tailles en octets, UTF-8 fragmenté, limites, type MIME exact, refus sans mutation.
- Ressources statiques autorisées et modules versionnés; absence d’exécution de HTML injecté dans les libellés.
- Safe-to-Spend, enveloppes, cartes, récurrences, budgets calendaires, rapprochements, vue simplifiée et simulations d’achat.

Les essais de navigateur utilisent Chromium sous Linux. Ils ne remplacent pas une vérification sur Safari/iOS et un vrai Mac avec `launchd`, Gatekeeper et Tailscale Serve.

L’[archive des anciens rapports](docs/tests-archive.md) conserve notamment la référence des étapes 0 et 1, avec les échecs d’interface historiques constatés à cette époque. Les nouveaux résultats ne réécrivent pas cet historique.
