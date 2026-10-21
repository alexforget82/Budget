# Sillage 2026

Budget personnel local pour Mac, accessible sur iPhone avec Tailscale privé. Données SQLite sur votre Mac, aucune connexion bancaire automatique. **Node.js 22.13+**, recommandé : Node 24. Aucun paquet npm à installer pour utiliser l’application, aucune compilation et aucun CDN.

## Installer ou mettre à jour

Téléchargez et décompressez [la version v13.1.1](https://github.com/alexforget82/Budget/archive/refs/tags/v13.1.1.zip).

- Installation automatique existante : **Applications → Sillage → Mettre a jour Sillage.command**, puis choisissez le nouveau dossier complet.
- Première installation : placez votre dossier `data/` existant près du fichier **Installer acces automatique.command**, puis lancez-le. L’installateur refuse de créer un budget vide à la place de vos données.
- Rechargez complètement Safari après la mise à jour. Il n’est pas nécessaire d’ouvrir une nouvelle fenêtre.

Le service conserve les finances dans `~/Library/Application Support/Mon Budget/data/`. Le dossier téléchargé n’est pas la base active après une installation automatique. Les [consignes de retour à la v11.1](docs/RETOUR-11.1.md) expliquent le raccourci de récupération et l’archive figée; le retour conserve les transactions actuelles.

Pour un lancement manuel depuis un dossier de travail :

```sh
npm start
```

Ouvrez `http://127.0.0.1:3030`. Le dossier `data/` utilisé est celui du répertoire courant. Ne lancez pas deux serveurs sur le même port ou deux copies différentes de votre budget.

## Payer une carte

Dans **Comptes**, choisissez **Payer cette carte**. Vérifiez le compte bancaire, le montant réellement payé et la date; consultez l’aperçu avant/après, puis confirmez. Aucun virement bancaire n’est exécuté par Sillage. Les achats doivent déjà être enregistrés dans Transactions. [Guide v13.1](docs/SILLAGE-13.1.md).

## Présentation v13

[Le tableau de bord et les enveloppes ont été remaniés](docs/SILLAGE-13.md), sur ordinateur et téléphone, en clair et en sombre. Les calculs, les données et les liens iPhone restent ceux de votre application. Les commandes de gestion des enveloppes se trouvent dans **Gérer et comprendre**; les outils de groupe dans **Options des enveloppes**.

## Utiliser Sillage

- **Budget** compare les objectifs aux transactions classées, sans réserver d’argent. Les montants à la semaine et aux deux semaines sont multipliés par le nombre réel de dates du mois, jamais par une moyenne annuelle. Choisissez un calendrier si la ligne le demande.
- **Récurrences** programme les revenus, factures et virements. **Enveloppes** protège les sommes du Safe-to-Spend, à la date prévue ou plus tôt si alimentées. Chaque période future protège son propre montant, même si le report du restant est désactivé; les soldes bancaires réels restent inchangés.
- Enregistrez une dépense réelle dans **Transactions** et confirmez l’association proposée si elle remplace une échéance prévue.
- **Disponible jour par jour** permet de consulter les prévisions. La vue simplifiée utilise les mêmes calculs. Elle affiche aussi le restant de l’enveloppe active nommée « Épicerie » (accent facultatif), son prochain renouvellement et ses achats associés, sans exposer les autres enveloppes ni les comptes. Avant le début de la première période, la carte affiche le montant prévu et la date de début; elle reste également visible si le calendrier doit être configuré.

## Achats récurrents sur carte

Une récurrence comme **Apple One · 53,98 $ · Capital One** retire son montant du disponible prévu à sa date. Le solde du Conjoint ne change qu’au remboursement. Enregistrez l’achat réel et confirmez son association au prévu : la somme reste protégée jusqu’au paiement de la carte, sans deuxième déduction de cette somme.

La dette initiale de la carte n’est pas réservée automatiquement. La reconnaissance des achats récurrents réels commence à l’activation de la v12; un import historique sans effet sur les soldes ne crée pas de protection. Les autres achats sans enveloppe ni association à une récurrence gardent leur fonctionnement précédent. **Disponible maintenant** suit les opérations enregistrées et protections actuelles; **Minimum prévu** inclut les échéances qui ne sont pas encore passées dans le réel.

## Versions et iPhone

Dans **Sauvegardes → Version et mises à jour**, vérifier manuellement si un nouveau ZIP est publié, puis utiliser le raccourci Mac habituel. Aucun budget n’est transmis à GitHub et aucune mise à jour ne s’installe automatiquement. Le numéro de version apparaît aussi au bas de la vue simplifiée. Son lien reste le même. Le [guide iPhone v12](docs/IPHONE-12.md) permet de confirmer le fonctionnement sur votre appareil.

## Comprendre et vérifier le disponible

Depuis le tableau de bord, **Pourquoi ce montant ?** explique le solde moins les protections. Cliquez sur les lignes soulignées pour ouvrir les comptes ou les enveloppes concernés; choisissez une date pour suivre les mouvements prévus.

**Soldes à vérifier** ouvre le suivi des comptes inclus. **Rapprocher avec ma banque** compare le solde que vous saisissez avec Sillage et montre l’effet d’une éventuelle correction sur le disponible et les minimums 30/60/90 jours. Comparer ne modifie rien. Examinez d’abord les opérations et les pistes de doublons; une correction reste explicite et motivée. « Vérifié » signifie comparé à votre saisie, sans connexion bancaire automatique.

## Sur iPhone

La barre du bas donne accès à Accueil, Budget, Prévision et Transactions. **Plus** ouvre les autres écrans et le choix d’apparence. Les filtres secondaires se trouvent dans **Filtres et options**; le calendrier démarre en semaine. Les calculs et les données sont les mêmes que sur ordinateur.

## Questions dans ChatGPT

Dans **Outils et réglages → Poser une question à ChatGPT**, préparez puis vérifiez le fichier. Téléchargez-le, ouvrez ChatGPT et joignez-le à votre question. L’historique peut couvrir 90 jours, un an ou toutes les transactions. Les prévisions couvrent 90 jours; les budgets couvrent sept mois autour du mois courant. Aucun envoi automatique, aucune clé API. Le fichier contient des données financières personnelles et reste un instantané, sans lien d’accès privé. Régénérez-le après vos changements.

## Confidentialité et sauvegardes

Le serveur écoute uniquement sur `127.0.0.1`. L’accès distant propriétaire passe par le proxy Tailscale Serve et son identité autorisée. Le lien simplifié est un secret donnant accès à des montants limités; révoquez-le dans Sauvegardes si nécessaire. N’exposez pas directement les ports Node sur Internet et ne placez pas la base SQLite active dans un dossier iCloud synchronisé.

Exportez régulièrement une sauvegarde depuis **Sauvegardes** et conservez-en une copie hors du Mac. Les mises à jour et migrations produisent aussi des copies locales, qui ne protègent pas contre la perte du disque. Une restauration remplace les finances actives : conservez d’abord une exportation actuelle.

[Versions](CHANGELOG.md) · [Tests](TESTS.md) · [Architecture](docs/ARCHITECTURE.md) · [Vérification de sécurité](docs/SECURITE.md) · [Archives des guides](docs/versions-archive.md).
