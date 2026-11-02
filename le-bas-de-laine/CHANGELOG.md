# 1.1.0 — résumé du matin à 7 h

Notifications Web Push propriétaires, activées explicitement depuis l’application complète sur l’écran d’accueil iPhone. Résumé quotidien à 7 h America/Toronto, changement d’heure automatique et reprise avant 8 h. Détails masqués par défaut; option pour revenus/paiements prévus, renouvellements et limites à 80 % ou plus. Test, préférences par appareil, désactivation et suspension globale. Aucun envoi activé par la mise à jour seule; la vue simplifiée reste inchangée.

Chiffrement standard Web Push/VAPID sur primitives natives Node, sans dépendance de production ni frais API. Destinations restreintes aux services de push connus, redirections refusées. Clés/abonnements locaux privés et séparés du JSON financier; scope adresse/propriétaire, réservation persistante contre les doubles rappels, trois tentatives maximum et abonnements expirés désactivés. Service worker sans cache de pages ni lecture financière en arrière-plan. Schéma, calculs et formats de budget inchangés.

Validation : 148 tests Node, parcours navigateur ciblés avec APIs push simulées, chiffrement déchiffré par une bibliothèque indépendante. Aucune livraison réelle Apple/iPhone validée ici : le test depuis l’appareil reste nécessaire. Chromebook/Linux/serveur éveillés et Internet requis pour l’envoi.

# 1.0.0 — consolidation

Retrait de la mention version d’essai, version visible sur ordinateur et mobile, vocabulaire bancaire/prévision clarifié et guide intégré dans Plan. Champs mobiles à 16 px, boutons de 44 px et actions de formulaire accessibles dans une hauteur réduite. Moteur financier inchangé.

Installation : copie cohérente avant mise à jour, retour automatique du programme et des données si le nouveau démarrage échoue après migration; copie de l’état échoué conservée. Retour explicite à la version précédente avec le programme et son budget correspondant, sauvegarde séparée du budget récent, restauration de la situation courante si le retour échoue. Aucun changement du schéma 3, du JSON 3 ou des liens privés.

Validation : 139 tests Node, 16 parcours Chromium, restauration JSON via l’API réelle et retour réel 0.9.0 → 1.0.0 → 0.9.0 sur données fictives. Commandes systemd simulées pour ce dernier parcours; pas de validation matérielle iPhone ni de deux semaines d’usage revendiquées.

# 0.9.0 — classement et révision des transactions

Règles prioritaires de correspondance avec conditions compte/sens/montant, normalisation conservant les chiffres significatifs, propositions modifiables à la saisie et par ligne CSV, mémorisation facultative du commerçant. File de révision, compteur, validation individuelle et des lignes déjà classées par une règle. Sélection et changement de catégorie en lot avec aperçu exact du disponible, jeton anti-aperçu périmé et sauvegarde préalable; opérations liées à une échéance protégées. Aucun changement de calcul pour les règles ou marqueurs seuls. Schéma 3 et JSON 3, restauration JSON 1/2 maintenue, interface simplifiée partagée inchangée.

# 0.8.0 — deux fois par mois

Limites et programmations à deux jours fixes du mois. Montant par passage, fin de mois adaptée à février, ajustements bancaires et montant exceptionnel conservés. Calcul de périodes commun au navigateur et au serveur pour les achats anticipés. Budget mensuel et partage utilisent les deux dates réelles. Migration numérotée 002 avec sauvegarde préalable, schéma 2 et export JSON 2; restauration des anciens JSON 1 maintenue. Données et liens existants conservés, aucune conversion automatique de montant.

# 0.7.2 — retirer une limite ou une facture

Actions avec confirmation dans Plan et les éditeurs. Limite retirée sans supprimer la catégorie ni les achats; nettoyage du rattachement automatique Autres si nécessaire. Facture/revenu/virement programmé retiré de la liste et de la prévision par désactivation et marqueur d’archivage, sans casser les liens d’échéances déjà payées, les transactions ou les soldes vérifiés. Sauvegarde/restauration conserve le marqueur. Boutons adaptés aux petits écrans. Schéma inchangé.

# 0.7.1 — minimum sur 30 jours au premier plan

Minimum des 30 prochains jours comme montant principal, sur les écrans propriétaire et partagé; montant avant prochain revenu conservé dans le détail. Explication chiffrée et limites au jour exact du minimum, prévisions nettes incluant les revenus. Exploration quotidienne partagée conservée et vérifiée pour les 30 dates. Correction de la première échéance avancée avant la date nominale, auparavant omise une fois passée. Aucun changement de schéma ou de lien privé.

# 0.7.0 — budget mensuel simple

Plan accueille une vue mensuelle automatique Prévu/Réel/Écart, groupée par catégorie. Comptage des dates effectives, sans mensualisation moyenne; exceptions et reports de dates conservés. Totaux revenus, dépenses et équilibre, virements séparés, reports de limites distincts. Classement facultatif des règles, sans nouvelle configuration obligatoire. Tableau adapté aux petits écrans. Lecture seule, aucun changement du moteur de disponible, des données ou du lien simplifié.

# 0.6.0 — reports hebdomadaires dans le mois

Restant reporté de semaine en semaine dans le même mois; remise à zéro des reports au premier renouvellement du nouveau mois, sans réduire l’allocation. Activation à partir de la période courante, avec sauvegarde sur budget existant. Affichage Budget/Allocation/Report dans les limites, identique en lecture partagée. Protection unique des reports et des achats anticipés, sans emprunt de report entre mois. Prévision conservatrice des dépenses et allocations futures; limites mensuelles inchangées. Schéma à huit tables conservé.

# 0.5.2 — montant prévu pour une seule échéance

Action Modifier cette fois sur les opérations à venir, le calendrier et les retards. Montant positif spécifique à l’échéance, sans changer la règle ni créer une transaction. Retour au montant habituel sans perdre un report de date. Accès conservé à la saisie du montant/date réels depuis ce formulaire. Clarification du formulaire de modification de la règle. Schéma et moteur inchangés : utilisation des états d’échéance existants.

# 0.5.1 — fraîcheur et sauvegarde visibles

Date du dernier solde principal près du disponible. Rappel compact des échéances en retard avec accès à leurs actions existantes. Date/heure réelle de la copie quotidienne et téléchargement JSON du budget courant depuis Aujourd’hui; repère ajouté dans Plan. Vérification des copies SQLite avant annonce de réussite, avec cache par taille/date et signalement d’une copie endommagée. Indicateurs en lecture dans le lien simplifié, actions et export réservés au propriétaire. Aucun changement de calcul ou de schéma.

# 0.5.0 — suivi quotidien simplifié

Modification/suppression des virements, protection des liens d’échéance et des soldes vérifiés. Recherche accent-insensible et filtres catégorie/mois/compte, totaux séparant virements et opérations réelles, conservation des filtres après correction. Liste compacte des limites : limite/dépensé/restant/renouvellement. Simulateur Oui/Non dans le lien simplifié, avec options facultatives, même calcul que le propriétaire et API strictement en lecture. Trois écrans et schéma existants conservés.

# 0.4.6 — dates RRQ fournies de fin 2026

La fréquence RRQ utilise le 30 novembre et le 30 décembre 2026 fournis par l’utilisateur, sans produire un second versement le 31 décembre. Aperçus par date fournie/estimée et avertissement ciblé pour les mois non renseignés. Conversion protégée des décisions déjà enregistrées avec l’ancienne estimation du 31 décembre. Les autres fréquences sont inchangées. Liste 2027 explicitement déclarée estimative par l’utilisateur : non intégrée comme calendrier confirmé.

# 0.4.5 — explorer le disponible jour par jour

Graphique interactif sur 30 jours dans À surveiller : curseur tactile/clavier, sélection directe sur la courbe, axes chiffrés, repère et raccourci vers le minimum. Date choisie, disponible exact, revenus/paiements et renouvellements affichés dessous. Conservation de l’alerte distincte sur 90 jours et du jour choisi lors des rafraîchissements. Même composant en lecture simplifiée. Aucune modification du moteur ou des données.

# 0.4.4 — calendrier Mois / Liste

Grille mensuelle dans Plan, disponible quotidien issu de la simulation, revenus/paiements/renouvellements et détail au clic. Vue Liste quotidienne; navigation limitée aux 90 jours calculés; dates hors prévision sans montant; semaine du lundi au dimanche. Adaptation mobile avec détail exact sous la grille, dates négatives et repère du minimum. Conservation du mois ouvert après une action. Correction du raccourci Payée/Reçue/Effectué : la date réelle est aujourd’hui, plutôt que la date future de l’échéance; Montant conserve le choix de date explicite. Aucun changement du moteur financier ou du schéma.

# 0.4.3 — bas de laine québécois

Nouveau logo : bas traditionnel, pièces d’épargne et fleur de lys. PNG commun au menu, favicon, manifeste et icône iPhone; lanceur Linux mis à jour. Palette bleu québécois/crème/doré, thème sombre bleu nuit. Couleurs de revenus et alertes conservées. Contrastes principaux vérifiés; aucun changement de calcul ou de données.

# 0.4.2 — tutoriel de configuration

Aide contextuelle affichée automatiquement aux quatre étapes de la configuration initiale. Masquer/afficher conserve les saisies. Tutoriel consultable depuis Aujourd’hui et Plan, avec navigation précédent/suivant et une dernière fiche sur l’usage quotidien, sans modifier la configuration existante. En-tête adaptatif sur petits écrans. Aucun changement de calcul, de calendrier ou de schéma.

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
