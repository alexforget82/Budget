# Le bas de laine — contrat de calcul 1.1.0

Trois écrans, un seul achat à saisir, pas d’enveloppe à alimenter. Programme, données et liens séparés de Sillage. Toutes les opérations monétaires utilisent des cents entiers. Aucun changement du moteur de calcul dans les versions 1.0.0 et 1.1.0.

**Indicateurs.** Le chiffre principal est le minimum journalier des 30 premiers jours de la simulation, inclus aujourd’hui. Le minimum 90 jours et sa date restent disponibles. Le montant secondaire avant prochain revenu exclut le jour d’un revenu futur et reste plafonné à 30 jours. Les deux fenêtres et le curseur utilisent la même simulation; propriétaire et lien partagé ont les mêmes valeurs.

**Quatre lignes.** Au jour déterminant le minimum : solde bancaire initial, moins achats de carte déjà à payer, plus mouvements futurs nets des revenus/paiements, moins limites protégées cumulées. Le détail des limites donne exactement le total retenu pour cette date. Le disponible est une prévision, distincte d’un solde bancaire.

**Banque.** Dernier point de contrôle réel + opérations bancaires saisies après, sauf celles déjà incluses. La séquence globale persistante tranche l’ordre des opérations du même jour. Une vérification de solde ne règle pas les protections de carte. Les comptes d’épargne secondaires sont exclus du disponible principal.

**Limites.** Semaine, mois ou deux fois par mois. Chaque allocation est protégée à son renouvellement, sans débit bancaire fictif. Le restant est le budget moins les achats nets imputés, avec plancher zéro; les remboursements ne créent pas une réserve supérieure au budget. Les allocations futures restent protégées sans anticiper leur non-dépense.

À la semaine, les restants réels des périodes précédentes du même mois de renouvellement sont reportés, depuis la date d’activation et le début de la catégorie. Le premier renouvellement du nouveau mois annule le report, jamais l’allocation; le jour 1 civil ne réinitialise pas une période qui a commencé le mois précédent. Aucun report pour les limites mensuelles ou deux fois par mois.

Deux fois par mois utilise un premier jour 1–27 et un second postérieur jusqu’au 31, ramené au dernier jour des mois courts. Le montant est par passage, sans moyenne annualisée. Une limite peut commencer à une date future, sans protéger la période antérieure.

**Achats anticipés.** Date réelle conservée; période courante ou suivante choisie à la saisie. Un achat anticipé consomme d’abord sa prochaine allocation, puis les fonds inutilisés antérieurs du même mois quand les reports hebdomadaires sont activés. Ces fonds sont marqués utilisés et protégés une fois, sans emprunter un report d’un autre mois.

**Cartes.** Chaque achat non réglé crée une protection. Paiements et remboursements libèrent les protections de la même carte, dans l’ordre de saisie. L’excédent non couvert d’un paiement réduit le disponible. Ni dette totale antérieure ni crédit de carte n’est supposé. Un import distingue historique déjà payé et achats encore à payer, sans rejouer des paiements anciens contre de nouveaux achats.

**Factures.** Échéance à venir, payée ou reportée, avec annulation explicite. Une échéance passée non résolue demeure à couvrir. Payée crée l’opération réelle et résout l’échéance atomiquement. Le montant exceptionnel ne modifie que cette échéance. L’association depuis Transactions/CSV reste explicite. Une facture et une limite ne doivent pas protéger la même dépense. Retirer une programmation la désactive et masque sa ligne, en conservant transactions et états payés.

**Calendrier.** Conserver la date, jour ouvrable précédent ou suivant; revenus précédents et dépenses suivantes par défaut. Fermetures du système bancaire canadien, sans ajout du 24 juin comme fermeture nationale. Fin de mois adaptée aux mois courts. Les dates RRQ fournies de novembre/décembre 2026 sont connues; les autres restent estimées et signalées. Deux passages déplacés doivent être espacés pour éviter une collision de clés d’échéance. La première occurrence avancée avant sa date nominale reste énumérée.

**Budget mensuel.** Lecture globale des règles actuelles, exceptions et dates effectives, avec réel par date de transaction. Virements et reports séparés des allocations. Aucun historique figé des anciens budgets; aucune nouvelle réserve.

**Classement et révision.** Règles littérales prioritaires, propositions pour les nouvelles saisies/imports, aucune écriture rétroactive. Première priorité numérique puis identifiant. Accents/casse normalisés, seuls les numéros de lieu explicitement étiquetés sont retirés. Une opération liée à une échéance payée ne reçoit pas de proposition par règle. Le marqueur de révision ne change aucun calcul. Classement en lot : aperçu exact, jeton lié à l’état courant, sauvegarde, puis logique existante de modification; dates/comptes/montants préservés. Un changement de catégorie réimpute à la période de la date réelle; une catégorie inchangée garde sa période anticipée.

**Stockage et restauration.** Neuf tables, schéma 3, migrations numérotées avec copie SQLite préalable. JSON 3; JSON 1/2 restaurables avec historique validé et règles vides. Validation sur base temporaire avant remplacement, contrôle des références, copie avant restauration. Les mises à jour conservent un couple programme/données précédent; échec après migration = restauration des deux. Le retour explicite préserve séparément le budget récent.

**Validation.** Scénarios fictifs et comparaisons figées, sans écriture sur les données réelles. Les 12 références Sillage historiques restent identiques pour le modèle initial sans report. Les reports hebdomadaires sont une différence volontaire testée à part. Le contrôle d’un export reflète sa date et son contenu, pas les modifications réelles faites ensuite. Les captures Chromium ne prouvent pas le comportement matériel iOS ni deux semaines d’usage quotidien.

**Rappels (1.1.0).** Consentement propriétaire par appareil, iOS 16.4+ depuis l’écran d’accueil. Créneau 7 h–8 h America/Toronto; contrôle chaque minute, aucun rattrapage après. Résumé privé générique par défaut; détails nominatifs/chiffrés seulement sur option. Seuil de limite à 80 % du budget de période, après reports, dépenses nettes réelles; les renouvellements demeurent automatiques. Pas de notification répétée en journée.

Les souscriptions et clés VAPID sont dans un fichier local 0600, hors des neuf tables et hors du JSON du budget. Activation liée à l’adresse privée et au propriétaire; changement de scope = réactivation. Réservation par date persistée avant l’envoi, pour ne pas dupliquer une tentative incertaine après redémarrage. Les refus connus peuvent réessayer après cinq minutes, au plus trois fois dans le créneau; les réponses 404/410 désactivent l’abonnement. Même tag de jour et renotify=false. L’acceptation par le service n’est pas une preuve de réception sur iPhone.

Destination HTTPS limitée aux services Apple/Google/Mozilla/Microsoft connus, sans redirection; payload AES128GCM RFC8291/8188, signature VAPID ES256. Service worker sans interception fetch, sans cache, sans chargement de données du budget; un clic ouvre uniquement le tableau de bord de sa propre origine. L’effacement du budget suspend les rappels. Ni notification ni marqueur d’envoi ne modifie un calcul financier.

## Suivi et saisie 1.2

Le moteur financier reste identique. La liste des revenus échus couvre les 30 derniers jours, respecte report, annulation et montant exceptionnel. Recevoir un revenu crée la transaction existante; le drapeau déjà inclus clôt l’échéance sans modifier une seconde fois le solde de référence.

Les suggestions de commerçant sont normalisées et classées par date réelle puis ordre de saisie. Elles ne recopient ni montant ni date/période et ne remplacent pas les choix manuels.

La confirmation de notification est une déclaration de l’utilisateur, rattachée au dernier envoi de l’appareil, pas un accusé de livraison Apple. Les préférences/cache de mises à jour sont locaux hors JSON financier; vérification limitée à une source publique fixe, URL d’archive par tag validée, réponse bornée et délai limité. Aucune installation distante automatique.
