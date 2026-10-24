# Sillage 15.0 — un parcours plus simple

## Navigation

Les pages principales restent Tableau de bord, Comptes, Transactions, Budget, Récurrences et Prévisions. Budget possède trois vues : Budget et enveloppes, Gérer les enveloppes et Bilan mensuel. Les anciens liens `#bilan` et `#enveloppes` restent valides. Les vues complémentaires de planification sont regroupées dans « Autres vues ».

« Bien démarrer » reste masqué lorsque la configuration est terminée; son accès depuis les réglages est conservé. « Ma prochaine paie » devient un panneau du tableau de bord avec la date, le revenu et le minimum avant la paie. « Répartition et règles » conserve les outils détaillés existants.

## Budget et enveloppes

La grille réunit objectif mensuel, dépensé/reçu, disponible du budget, réserve protégée maintenant et prochain renouvellement. La réserve est déjà exclue du disponible à dépenser; elle n’est pas soustraite une deuxième fois au budget.

Les liens explicites du budget sont prioritaires. Sans lien explicite, une correspondance réciproque non ambiguë fournie par la mémoire de saisie peut rapprocher une catégorie et une enveloppe pour l’affichage seulement. Aucun lien financier n’est créé. Une enveloppe sans correspondance apparaît dans le groupe « Enveloppes hors budget mensuel · montants par période » : ces montants par période ne sont pas ajoutés au total mensuel. Les réserves et renouvellements sont ceux de la situation actuelle, même lorsqu’on consulte un autre mois budgétaire.

Les budgets par sous-catégorie, fréquences, reconductions et exceptions restent disponibles. Cliquer sur un renouvellement ouvre la fiche existante de l’enveloppe.

## Récurrences et prévisions

Les récurrences présentent date, compte, fréquence, montant, état et effet sur le disponible. Cet effet provient des événements de la prévision canonique : un virement interne peut avoir un effet nul, un achat couvert par une enveloppe peut être signalé comme couvert, une opération réelle comme déjà enregistrée. Hors de l’horizon calculé, la colonne indique « Hors prévision ». Le montant affiché n’est jamais une estimation reconstruite par l’interface. Liste et calendrier partagent les filtres et le mois affiché.

Le graphique conserve ses axes monétaires et affiche le minimum directement sur la courbe. Des points sélectionnables repèrent les jours avec paie, facture, virement ou renouvellement. Pour préserver la lisibilité, ils sont espacés lorsque les événements sont nombreux; le tableau en dessous contient tous les jours et tous leurs événements sur l’horizon 30/60/90 choisi. Le tableau présente la prévision actuelle, hors simulation. Cliquer sur une date ouvre son détail. Le graphique s’adapte en hauteur sur iPhone.

## Clavier et iPhone

- Ctrl+K ou ⌘K : recherche globale.
- N : nouvelle transaction.
- G puis A, T, B, R, P ou C : accueil, transactions, budget, récurrences, prévisions ou comptes.

Les touches simples sont inactives pendant une saisie ou lorsqu’un dialogue est ouvert. Sur iPhone, la barre du bas propose Disponible, Transactions, Budget et +. Le menu du haut conserve les autres pages. Un balayage horizontal d’une transaction ouvre le classement existant; aucun changement n’est enregistré avant validation. Le défilement vertical et le menu ⋯ restent disponibles.

Les libellés « Safe-to-Spend » et « STS » de l’interface sont remplacés par « Disponible à dépenser » ou « Disponible ». Les sous-titres répétés des pages principales sont allégés. Les instructions utiles à la configuration et aux confirmations sont conservées.

## Installation et données

Décompressez le ZIP v15.0.0. Ouvrez Applications → Sillage → Mettre a jour Sillage.command et choisissez le nouveau dossier complet. Actualisez Safari sur Mac et iPhone. Les données et liens privés restent en place. La vue privée simplifiée conserve ses fonctions; il n’est pas nécessaire de recréer son lien.

Aucune migration de base ni modification des moteurs de prévision, de protection des cartes ou de renouvellement des enveloppes. Les calculs sont réutilisés, et non fusionnés. Les contrôles incluent une installation copiée, la navigation, les modifications, les sauvegardes/restaurations et les comparaisons financières avant/après. Les captures sont faites avec des données fictives, pas votre budget.
