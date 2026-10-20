# Revenir à Sillage v11.1

La v11.2.0 livre uniquement les étapes 0 et 1 du chantier technique. Les étapes suivantes attendent une validation séparée.

## Retour habituel depuis une mise à jour de la v11.1 officielle

1. Ouvrez **Applications → Sillage → Revenir a Sillage 11.1.command**.
2. Confirmez **Revenir à 11.1**.
3. Attendez le message de fin, puis rechargez complètement Safari. La version en bas à gauche doit être **v11.1.0**.

Le raccourci utilise une copie locale du code officiel, créée avant son remplacement et vérifiée par SHA-256. Il reste utilisable si le nouveau serveur ne démarre pas. Le service est arrêté puis relancé par l’installateur original; une sauvegarde cohérente de la base actuelle est créée avant le retour. Le dossier `data/` n’est pas remplacé par celui d’un téléchargement : **les transactions ajoutées après la mise à jour restent présentes**. Le lien iPhone et la configuration privée sont conservés.

Cette compatibilité a été testée pour le schéma 1 de la v11.2.0. Elle ne garantit pas la compatibilité avec d’éventuels changements de schéma futurs.

La copie se trouve dans :

`~/Library/Application Support/Mon Budget/data/backups/sillage-v11.1.0-release/`

Les sauvegardes SQLite avant migration portent le nom `budget-before-schema-v1-…sqlite`. Celles de l’installateur portent le nom `budget-before-service-update-…sqlite`. Elles se trouvent dans le même dossier `data/backups/`. Ne supprimez pas ce dossier si vous voulez conserver le retour local et les copies de récupération.

## Si le raccourci manque ou si la copie locale est endommagée

L’archive figée ne dépend pas de la branche main :

[Télécharger la v11.1 officielle](https://github.com/alexforget82/Budget/archive/bb25864082819775d6ce65d860cbe30806c01e54.zip)

1. Téléchargez et décompressez cette archive.
2. Dans ce dossier, lancez **Installer acces automatique.command** directement. Le sélecteur « Mettre a jour » refuse normalement les versions antérieures : ce n’est pas le chemin de retour.
3. Si macOS demande une autorisation pour ce téléchargement, utilisez son autorisation habituelle dans Confidentialité et sécurité. Ne désactivez pas Gatekeeper.
4. Attendez la fin et rechargez complètement Safari.

Sur une installation automatique existante, l’installateur retrouve la base dans Application Support; il ne faut pas recopier un dossier `data/` vide. Si un serveur a été lancé manuellement dans Terminal, arrêtez cette instance avec Control+C avant l’installation, comme l’indique le lanceur. Tailscale peut rester connecté.

## Revenir au code ou restaurer des finances

Le retour au code v11.1 **ne remet pas les finances à une ancienne date**. C’est le choix adapté pour annuler cette mise à jour technique.

Pour une restauration des finances, utilisez une sauvegarde JSON dans **Sauvegardes** après avoir conservé une copie actuelle. Ne remplacez pas à chaud un fichier SQLite pendant que le service fonctionne. Une restauration d’un ancien état retire les saisies faites après cette sauvegarde; elle nécessite donc une décision distincte.
