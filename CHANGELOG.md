# Versions de Sillage

## 14.1.0 — tableau de bord et corrections ciblées

Horizon 30/60/90 et accès jour par jour en premier; recherche, annulation, personnalisation, scénarios, rapprochement et explications réunis dans Plus. Apparence et État des données passent dans Outils et réglages, sur ordinateur comme sur téléphone. Le minimum prévu est plus lisible à droite du disponible. Le graphique porte une échelle monétaire et marque les extrêmes du même horizon, y compris le montant actuel. Le compte est désigné par « Disponible à dépenser ».

Les montants numériques avec une fraction de cent sont refusés avant écriture, au lieu d’un arrondi implicite. Modifier financièrement une transaction réutilise les deux sources de couverture d’enveloppe déjà consultées à sa création; la transaction modifiée est exclue de sa propre recherche de reçu. Les jours bancaires observés de Noël et du lendemain ne se superposent plus; le 30 septembre et le 11 novembre sont inclus. Le dernier jour ouvrable évite aussi les jours fériés. Une date fixe sans ajustement reste inchangée.

Les sept feuilles CSS actives sont consolidées en quatre fichiers canoniques, sans nouvelle couche de version : fondation, domaines, présentation Sillage et variables. Les anciens liens CSS restent des points de compatibilité. Avant les changements de tableau de bord, les styles calculés de 11 516 éléments sur 36 vues sont identiques. Aucune migration de base ni réécriture des opérations existantes.


## 14.0.0 — refonte de la présentation

Palette neutre en clair et en sombre, accent moins saturé, typographie et nombres alignés, boutons et espacements uniformes. Les budgets et transactions utilisent des registres compacts et des bandes de totaux. Les enveloppes passent d’une grille de grandes cartes à une liste : nom, restant, renouvellement et Gérer, avec les détails toujours accessibles. Les onglets de planification sont soulignés plutôt qu’affichés comme de gros boutons.

Le tableau de bord garde le disponible actuel en premier, avec son minimum prévu et sa trajectoire. Le détail du calcul est replié, sans retirer son explication. Le compte utilisé pour le Safe-to-Spend est affiché près du montant au lieu d’un bandeau répété sur tous les écrans. Les titres secondaires sont raccourcis. La vue iPhone conserve ses zones tactiles, sa navigation du bas et les correctifs de clavier; la vue privée partagée adopte le même style et regroupe les extrêmes côte à côte. Les liens existants restent valides.

Aucune migration ni modification des moteurs financiers. Les contrôles et événements existants sont réutilisés, avec comparaison des tables financières avant/après navigation et vérification des montants affichés contre l’API canonique.

## 13.3.0 — phases 2 et 3 : période à la saisie et enveloppes simplifiées

Pour un achat anticipé dans une enveloppe en budget protégé, le formulaire propose la période actuelle ou un prochain renouvellement compatible dans les sept jours. Le choix reste volontaire. L’achat et son lien de période sont enregistrés dans une seule transaction SQLite, en réutilisant la saisie existante et le lien explicite. La date réelle est conservée et la période reste ouverte pour d’autres achats. Les aperçus ne créent rien; des données modifiées entre-temps imposent de revérifier le choix. La saisie attend la vérification de période et empêche les doubles soumissions. Les imports et modifications de transactions ne sont pas associés automatiquement.

Le formulaire d’enveloppe met en avant le nom, le budget, la fréquence, la date de départ et le traitement du restant. Réserve actuelle, état et ancien mode de paiement restent dans Options avancées. Un raccourci mène à la création d’une facture dans Récurrences. Les enveloppes existantes ne sont ni converties ni reprogrammées. L’alimentation récurrente n’est plus proposée à la création pour une enveloppe qui se renouvelle déjà; les anciennes règles restent modifiables.

Les cartes de budget protégé montrent le restant de la période ou, avant son début, celui du prochain budget, avec sa date de renouvellement. Les réserves restent dans les détails; Gérer est l’entrée de gestion commune. Aucun changement de schéma ni des moteurs de prévision ou de protection des cartes. La séparation du modèle, optionnelle en phase 4, n’est pas effectuée.

## 13.2.0 — simplifier la saisie et le classement des enveloppes

L’enveloppe est visible dans le formulaire de dépense. Les choix du dernier achat au même nom de commerçant normalisé sont proposés à la saisie et dans le CSV. Les accents, la casse, les espaces et la ponctuation sont neutralisés; aucune correspondance approximative entre commerces différents. Les relations catégorie/enveloppe sont proposées seulement lorsqu’elles sont uniques, sans configuration dans Budget. Les choix manuels, y compris aucune enveloppe ou Non-catégorisé, restent prioritaires.

Le filtre Sans enveloppe porte sur tout le registre. La modification en lot propose Changer l’enveloppe et un aperçu des réserves et du Safe-to-Spend avant/après, sans écriture avant confirmation. Elle réutilise le traitement de modification unitaire et signale les associations de période qui seront retirées. Les montants, dates et mouvements bancaires restent ceux des transactions existantes; les réserves changent selon leur nouvelle affectation. Le CSV conserve également son mode historique sans effet sur les soldes.

Aucune modification du schéma ni des moteurs de prévision et de protection des cartes. L’association d’un achat anticipé à une période future reste volontaire : le choix de période à la saisie appartient à la phase 2.

## 13.1.2 — associer un achat anticipé à un budget réservé

Le menu « Associer au prévu » propose maintenant les périodes futures des enveloppes en mode budget protégé, distinctes des dépenses programmées. L’association volontaire d’une transaction déjà affectée à cette enveloppe conserve la date et les soldes réels, réduit seulement le budget futur restant et ne termine pas la période. Les associations répétées, les dates incompatibles et les données devenues périmées sont refusées.

La fiche précise le restant du prochain budget, même avant sa date de début. Exemple : 71,69 $ d’épicerie le 21 associé au budget de 230 $ du 22 laisse 158,31 $, également dans la vue simplifiée. Sans association volontaire, la correction 13.1.1 reste en vigueur. L’en-tête des fiches est opaque sur téléphone pour éviter la superposition des textes pendant le défilement.

## 13.1.1 — une ancienne dépense ne consomme plus automatiquement la première période

Correction de l’attribution implicite des achats antérieurs au début d’une enveloppe. Sélectionner une enveloppe dans une transaction passée ne suffit plus à remplacer son premier budget futur. Un achat explicitement associé à cette occurrence continue de la consommer; les avances de financement conservent leurs règles. Le même calcul sert aux prévisions et aux renouvellements réels. Aucun achat ni solde bancaire existant n’est modifié.

Exemple : achat Essence Alex de 60 $ le 20 octobre, début hebdomadaire le 27 octobre. Sans association explicite au 27, la prévision protège 60 $ le 27, puis de nouveau les semaines suivantes. Correctif commun à toutes les enveloppes.

## 13.1.0 — paiement réel des cartes et confort iPhone

Dans Comptes, chaque carte propose **Payer cette carte**, distinct de la planification des remboursements. Le compte du budget est présélectionné, avec le montant protégé sur la carte lorsqu’il existe. Un aperçu sans écriture montre les soldes bancaire et carte, le disponible actuel et son minimum sur 30 jours avant/après. La confirmation réutilise le virement réel existant. Un remboursement prévu correspondant de façon unique est reconnu; les cas encore à associer sont signalés.

Les confirmations sont à usage unique, expirent après cinq minutes et sont refusées si les données ont changé. Un paiement identique déjà saisi nécessite une reconnaissance explicite. Les crédits sur carte et comptes exclus suivent le moteur actuel, sans nouveau calcul de protection ni changement de schéma.

Sur téléphone : boutons et champs lisibles, fenêtre adaptée à la zone visible avec le clavier, navigation inférieure masquée pendant la saisie, distinction entre clavier et zoom, en-tête opaque pendant le défilement. La réponse à la simulation d’achat de la vue simplifiée est amenée au focus. Les liens privés existants sont conservés. Essais Chromium et changements de viewport simulés; aucune validation sur iPhone physique.

[Installation et vérifications](docs/SILLAGE-13.1.md).

## 13.0.0 — la présentation approuvée devient l’interface réelle

Tableau de bord recentré sur le disponible actuel, avec minimum prévu, détail des protections, graphique, minimum/maximum sur 30/60/90 jours, prochains mouvements, enveloppes et derniers achats. Le graphique réutilise son rendu et ses données existants; le mode détaillé et la personnalisation restent disponibles. Le raccourci vers la prochaine rentrée d’argent est conservé.

Les enveloppes deviennent des cartes compactes avec recherche sans distinction d’accents, filtres de fréquence et détails de gestion repliables. Réserve inutilisée, achats et renouvellement restent distincts. Les contrôles existants d’ajustement, de suppression, de sélection et de configuration conservent leurs actions. Le thème commun et la vue simplifiée reçoivent une finition visuelle; aucun nouveau lien partagé n’est nécessaire. Ressources versionnées, validation de l’installateur mise à jour. Aucun changement du schéma SQLite ni des règles financières.

[Installation, captures et vérifications](docs/SILLAGE-13.md).

## 12.0.0 — récurrences sur carte protégées et repères plus clairs

Les dépenses récurrentes sur carte sans enveloppe réduisent désormais le disponible prévu à leur date, sans diminuer le solde bancaire. Les achats réels identifiés ou explicitement associés au prévu restent protégés jusqu’au remboursement; celui-ci libère la protection sans deuxième déduction. Les paiements partiels, achats anticipés, exceptions et remboursements marchands sont couverts. La dette initiale générale et les imports historiques ne deviennent pas des réserves. La protection des achats récurrents réels démarre à l’activation de la v12, conservée après redémarrage, remise à zéro et restauration. Les associations déjà reconnues restent stables lors d’un changement de tarif; la suppression d’une récurrence ne libère pas un achat réel encore à payer.

Les cartes d’enveloppes précisent la période, le prochain renouvellement et le report, avec la différence entre objectif et protection actuelle. La vue simplifiée affiche le numéro de version et propose de recharger l’interface lorsqu’elle diffère du serveur. Dans Sauvegardes, une vérification manuelle consulte la version publique GitHub et propose le ZIP si elle est plus récente; aucune donnée financière n’est envoyée et aucune installation n’est automatique. Les sauvegardes et le retour à la v11.1 restent disponibles. Guide de validation Safari/iPhone ajouté; essais réalisés sous Chromium, pas sur appareil iOS réel.

## 11.6.0 — comprendre et vérifier son disponible

Les lignes Solde bancaire inclus et Argent protégé ouvrent le détail du calcul actuel ou le chemin quotidien de la prévision. Le tableau de bord indique les comptes inclus à vérifier, la dernière validation et les vérifications devenues obsolètes. Le rapprochement montre le solde enregistré avant saisie et un aperçu du disponible actuel et des minimums sur 30/60/90 jours si ce seul solde était corrigé. L’aperçu utilise le moteur canonique, sans écriture. Les recherches de doublons et de transactions manquantes existantes restent accessibles. Une modification du compte ou des opérations invalide l’aperçu affiché; toute correction exige toujours une action explicite et une note. Sur téléphone, le résultat prend le focus après comparaison. Aucun changement des règles de calcul, des enveloppes ou des remboursements de carte.

## 11.5.2 — épicerie toujours visible

Le suivi partagé reste visible avant la première période : montant prévu et date de début. Sans calendrier, la carte présente la réserve actuelle et indique la configuration manquante. Si aucune enveloppe ne peut être identifiée, un état de configuration remplace la disparition de la carte. Les achats anticipés associés à la première échéance sont inclus. Le lien existant reste valide; calcul du Safe-to-Spend conservé.

## 11.5.1 — épicerie dans la vue simplifiée

Carte de suivi de l’enveloppe active Épicerie : budget de la période, achats associés, restant et prochain renouvellement. Liste d’achats repliable, libellés rendus comme texte, aucun compte ou autre enveloppe exposé. Le montant et le calendrier viennent de l’enveloppe existante; aucun montant de 230 $ ou 203 $ n’est imposé. Le report est respecté lorsque le renouvellement courant a été appliqué. Les achats associés à une autre période ne sont pas déduits deux fois. Actualisation et révocation du lien effacent les données devenues indisponibles. Calcul du Safe-to-Spend conservé.

## 11.5.0 — interface iPhone

Navigation rapide en bas, en-tête compact, version en bas à gauche, options secondaires repliées sur téléphone. Budget : mois lisible et montants sans coupure. Transactions : filtres regroupés pour laisser voir les opérations. Prévision : compte et scénarios regroupés, résumé compact. Calendrier mobile initial en semaine avec choix du mois conservé. Formulaires adaptés au toucher, fenêtres en bas d’écran et prise en compte des zones de sécurité. Vue simplifiée plus compacte. Contrôles et gestionnaires existants réutilisés, calculs conservés; disposition ordinateur restaurée au changement de largeur.

## 11.4.3 — fichier pour poser des questions dans ChatGPT

Ajout dans Outils et réglages : préparer et vérifier un instantané financier, le télécharger puis ouvrir ChatGPT pour le joindre à une question. Historique au choix (90 jours, un an, tout), comptes, budgets, enveloppes, récurrences et prévisions canoniques. Aucun envoi automatique ni clé API. Export propriétaire distinct des sauvegardes, sans configuration ni jeton d’accès. Calculs financiers conservés.

## 11.4.2 — protection de chaque période future

Corrige une surestimation du Safe-to-Spend lorsque plusieurs périodes d’un budget protégé réutilisaient la même réserve avec le report désactivé. Chaque semaine/mois futur protège son propre montant. Les alimentations anticipées et achats associés au début de période sont comptés une seule fois, sur compte bancaire ou carte. Les soldes réels et la règle de report lors du renouvellement réel restent conservés. La v11.4.1 ne corrigeait que l’affichage de ces échéances.

## 11.4.1 — renouvellements d’enveloppes au calendrier

Les renouvellements hebdomadaires restent visibles lorsque la réserve supplémentaire est nulle. Le détail indique « Réserve inchangée » lorsque le renouvellement ne change pas le disponible. Les calculs, les choix de report et les soldes bancaires restent inchangés.

## 11.4.0 — organisation et robustesse, étapes 2 à 5

- Base et transactions SQLite, calendrier des récurrences, routes par domaine, lecture HTTP, fichiers statiques et contrôles d’accès séparés du serveur principal. Calculs conservés.
- Une entrée JavaScript native ES, initialisation explicite par domaine et un pont de compatibilité pour les anciens points d’accès. Pas de compilation ni de dépendance npm à l’exécution.
- Quatre feuilles CSS faisant autorité, regroupées par responsabilité, avec couches de cascade et palette isolée. Anciennes URL conservées comme petits renvois; trois `!important` redondants retirés après comparaison. Les autres priorités restent conservées pour préserver l’apparence.
- Ressources de l’interface versionnées pour le cache Safari, fichiers installables vérifiés avant l’arrêt du service, copie installée testée.
- Contrôles JSON exacts, limites mesurées en octets, corps non objet refusés avant mutation et jeton de consultation malformé traité en refus d’accès.
- README raccourci, architecture, sécurité et historique séparés. Tests anciens adaptés à la navigation réelle, sans supprimer leurs contrôles financiers.

Cette version ne constitue pas une refonte mobile ni un hébergement Internet public. La vue simplifiée et les règles du Safe-to-Spend restent conservées. Les sauvegardes et le retour à la v11.1 restent disponibles.

## 11.3.0 — occurrences réelles dans Budget

Comptage des dates du mois pour les budgets à la semaine et aux deux semaines : 4/5 ou 2/3 occurrences. Montant unitaire conservé, choix de calendrier explicite si nécessaire, sous-catégories et exceptions maintenues. Safe-to-Spend inchangé.

## 11.2.0 — étapes 0 et 1

Référence de tests, migrations numérotées et atomiques, sauvegardes cohérentes avant migration et retour au code v11.1 avec conservation des transactions.

## 11.1.0 — association proposée à la saisie

Proposition de rapprochement entre une transaction réelle et une échéance proche, à confirmer. Évite de déduire deux fois la même opération.

## 11.0.0 — Sillage 2026

Identité visuelle Sillage 2026, navigation regroupée et harmonisation des écrans.

Les [notes et guides historiques complets](docs/versions-archive.md) restent disponibles. Les tags Git figent les versions livrées.
