# Sillage 2026

Budget personnel local pour Mac, accessible sur iPhone avec Tailscale privé. Données SQLite sur votre Mac, aucune connexion bancaire automatique. **Node.js 22.13+**, recommandé : Node 24. Aucun paquet npm à installer pour utiliser l’application, aucune compilation et aucun CDN.

## Installer ou mettre à jour

Téléchargez et décompressez [la version v11.4.2](https://github.com/alexforget82/Budget/archive/refs/tags/v11.4.2.zip).

- Installation automatique existante : **Applications → Sillage → Mettre a jour Sillage.command**, puis choisissez le nouveau dossier complet.
- Première installation : placez votre dossier `data/` existant près du fichier **Installer acces automatique.command**, puis lancez-le. L’installateur refuse de créer un budget vide à la place de vos données.
- Rechargez complètement Safari après la mise à jour. Il n’est pas nécessaire d’ouvrir une nouvelle fenêtre.

Le service conserve les finances dans `~/Library/Application Support/Mon Budget/data/`. Le dossier téléchargé n’est pas la base active après une installation automatique. Les [consignes de retour à la v11.1](docs/RETOUR-11.1.md) expliquent le raccourci de récupération et l’archive figée; le retour conserve les transactions actuelles.

Pour un lancement manuel depuis un dossier de travail :

```sh
npm start
```

Ouvrez `http://127.0.0.1:3030`. Le dossier `data/` utilisé est celui du répertoire courant. Ne lancez pas deux serveurs sur le même port ou deux copies différentes de votre budget.

## Utiliser Sillage

- **Budget** compare les objectifs aux transactions classées, sans réserver d’argent. Les montants à la semaine et aux deux semaines sont multipliés par le nombre réel de dates du mois, jamais par une moyenne annuelle. Choisissez un calendrier si la ligne le demande.
- **Récurrences** programme les revenus, factures et virements. **Enveloppes** protège les sommes du Safe-to-Spend, à la date prévue ou plus tôt si alimentées. Chaque période future protège son propre montant, même si le report du restant est désactivé; les soldes bancaires réels restent inchangés.
- Enregistrez une dépense réelle dans **Transactions** et confirmez l’association proposée si elle remplace une échéance prévue.
- **Disponible jour par jour** permet de consulter les prévisions. La vue simplifiée utilise les mêmes calculs.

## Confidentialité et sauvegardes

Le serveur écoute uniquement sur `127.0.0.1`. L’accès distant propriétaire passe par le proxy Tailscale Serve et son identité autorisée. Le lien simplifié est un secret donnant accès à des montants limités; révoquez-le dans Sauvegardes si nécessaire. N’exposez pas directement les ports Node sur Internet et ne placez pas la base SQLite active dans un dossier iCloud synchronisé.

Exportez régulièrement une sauvegarde depuis **Sauvegardes** et conservez-en une copie hors du Mac. Les mises à jour et migrations produisent aussi des copies locales, qui ne protègent pas contre la perte du disque. Une restauration remplace les finances actives : conservez d’abord une exportation actuelle.

[Versions](CHANGELOG.md) · [Tests](TESTS.md) · [Architecture](docs/ARCHITECTURE.md) · [Vérification de sécurité](docs/SECURITE.md) · [Archives des guides](docs/versions-archive.md).
