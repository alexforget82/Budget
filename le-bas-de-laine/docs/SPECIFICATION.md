# Le bas de laine — contrat du noyau, essai 0.4.0

**But** : une seule saisie par achat, pas de financement manuel, trois écrans, disponible explicable en quatre lignes. Application et données séparées de Sillage. Le 30 octobre 2026 sert de date fixe dans l’exemple de comparaison; chaque rapport enregistre sa date de référence explicite. Les aperçus utilisent le 21 octobre 2026 et des chiffres fictifs.

**Fenêtres** : minimum journalier avant la première prochaine paie du compte principal (jour de paie exclu), plafonné à 30 jours; minimum sur les 90 jours complets. Sans paie connue dans la fenêtre, le premier indicateur couvre 30 jours et le précise. La même simulation fournit les deux. Le disponible avant la paie reste plafonné à 30 jours; la simulation, l’alerte et la comparaison couvrent 90 jours.

**Banque** : dernier point de contrôle réel + opérations bancaires saisies après, sauf historique déjà inclus. L’ordre est une séquence globale persistante; aucune ambiguïté entre opérations du même jour. Les cartes ne sont pas des comptes de trésorerie. Un contrôle bancaire ne réinitialise pas leurs achats à payer.

**Limites** : une catégorie, un montant, semaine ou mois, renouvellement. Le restant vaut limite moins achats nets imputés, avec plancher zéro; un remboursement ne crée pas une réserve supérieure à la limite. Chaque période commençant avant la paie est protégée, dans les 30 jours. Les périodes futures s’accumulent dans la prévision sans débiter fictivement la banque. Le mois utilise ses dates réelles, y compris fins de mois et années bissextiles. Aucun report de budget inutilisé.

**Anticipation** : date réelle conservée; période actuelle ou suivante à la saisie. Le prochain restant tient compte des achats déjà imputés. Une limite peut commencer à une date future, sans protéger la période antérieure.

**Cartes** : chaque achat non réglé crée une protection, quelle que soit sa catégorie. Les paiements et remboursements libèrent les protections de la même carte, dans l’ordre de saisie; la part non couverte d’un paiement réduit le disponible. Ni dette initiale totale ni solde créditeur bancaire de carte n’est suivi. L’historique importé distingue déjà payé et encore à payer; il ne rejoue pas les anciens paiements contre les nouveaux achats.

**Factures** : à venir, payée, reportée; annulation explicite possible dans l’API. Passée non résolue = obligation conservée. Payée crée l’opération et résout l’échéance atomiquement; le montant réel ne change pas la récurrence. Une suggestion depuis Transactions/CSV reste un choix explicite. Une facture et une limite ne doivent pas couvrir la même dépense. Les virements entre comptes et paiements de carte ne comptent pas comme dépenses de catégorie.

**Import** : identité source stable, même fichier sans effet, modification sur même ligne, conflit plutôt qu’écrasement. Nouveau contrôle bancaire cohérent avec le point source. Règles sans équivalent indiquées et disponible provisoire si une protection manque. Les comparaisons n’inventent pas d’attribution d’erreur : toute différence non classée empêche de valider la bascule.

**Exploitation** : écoute locale 3040, accès privé Tailscale sur 3041 derrière HTTPS 8443, identité propriétaire vérifiée, lien de lecture révocable. Sillage 3030/HTTPS 443 non modifié. Sauvegardes SQLite cohérentes et export/restore JSON. Aucun service bancaire ou IA, aucune dépendance de production.

**Hors périmètre** : enveloppes séparées, sous-catégories, objectifs, scénarios, export ChatGPT, appariement à confirmer après saisie, comparaison au-delà de 90 jours. Le calendrier d’essai parallèle réel et la revue des données personnelles restent à faire par l’utilisateur.

**Étape 1** : coussin Autres facultatif de 50 $/mois, sans migration financière silencieuse. Les dépenses hors limite consomment ce coussin sans changer leur classement; les factures associées en sont exclues. Le détail des réservations est dérivé du même jour contraignant que les quatre lignes. Les douze scénarios de référence figés en 0.1.0 doivent conserver exactement leur disponibilité et leurs 30 premières journées.

**Outils 0.4.0** : un achat hypothétique est injecté dans le même moteur à sa date réelle; la consommation de sa limite ne commence qu’à cette date. Aucun effet avant l’achat, aucune seconde protection si sa limite le couvre. La réponse vérifie 30 jours complets, avec minimum/maximum et date du minimum. L’épargne a son propre point de contrôle, et ne rejoint jamais automatiquement le compte principal. Le bilan mensuel additionne les dépenses réelles, sans virements. L’agenda ne couvre que les échéances ouvertes des 90 jours simulés.

**Calendrier** : défauts sur les nouvelles règles : revenu avant, dépense/virement après. Les règles enregistrées conservent leurs choix. Les dates sont comparées au moteur Sillage, pas certifiées par Paiements Canada : revue officielle encore ouverte.
