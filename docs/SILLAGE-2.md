# Sillage 2

Quatre entrées pour l’usage quotidien : **Disponible**, **Transactions**, **Budget**, **À venir**. Les comptes, catégories, imports et sauvegardes sont dans **Réglages**. Les autres outils restent accessibles sous **Outils avancés**. Les anciennes routes et leurs fonctions sont conservées.

Disponible montre l’argent libre, le minimum prévu et le graphique. Le détail de la prochaine paie et les explications sont repliés. La prévision complète et la simulation d’un achat restent à portée de clic. Budget conserve catégories, sous-catégories, enveloppes et bilan. À venir conserve la liste et le calendrier des récurrences. Les quatre mêmes destinations sont dans la barre du bas sur iPhone.

La saisie garde montant, description, compte et catégorie au premier plan. L’enveloppe reste visible pour vérifier la protection de l’achat; une sous-catégorie sans choix utile n’occupe plus une ligne. La date est sous « Date de la transaction »; elle reste présélectionnée et devient visible pour un virement. Les contrôles et validations existants sont réutilisés.

**Sillage 2 utilise la version technique 16.0.1**, affichée en bas. Cette numérotation permet la mise à jour depuis la série 15 sans créer un nouveau format de données. Aucun moteur financier, schéma SQLite ou calcul de réserve n’est modifié.

## Chromebook : installer ou migrer la version 15

Node.js 24 doit être installé dans l’environnement Linux. Aucun `npm install` n’est nécessaire.

Si `npm start` fonctionne encore dans un Terminal, arrêtez-le avec **Ctrl+C**. L’installateur arrête lui-même l’ancien service `sillage.service`, s’il existe.

Dans le Terminal Linux :

```bash
mkdir -p ~/Applications
cd ~/Applications
curl -fL https://github.com/alexforget82/Budget/archive/refs/tags/v16.0.1.zip -o Sillage-2.zip
unzip Sillage-2.zip
cd Budget-16.0.1
bash "Installer Sillage Linux.sh"
```

L’installateur recherche les bases dans les dossiers versionnés `~/Applications/Budget-X.Y.Z/data`. S’il en trouve une seule, il la reprend. S’il en trouve plusieurs, il demande de choisir explicitement. Une installation stable existante conserve sa base. Un dossier de données non standard se précise ainsi :

```bash
bash "Installer Sillage Linux.sh" --import-data "/chemin/vers/data"
```

Avec uniquement une sauvegarde JSON exportée depuis **Sauvegardes**, créez explicitement une installation vide, puis restaurez le fichier dans **Réglages → Sauvegardes** :

```bash
bash "Installer Sillage Linux.sh" --new
```

L’installateur refuse de remplacer un budget stable existant avec `--import-data` ou `--new`. Une mise à jour normale n’utilise aucun de ces paramètres. Conservez votre ancienne copie tant que vous n’avez pas vérifié vos chiffres.

## Ouvrir et mettre à jour

Ouvrez **Sillage 2** dans le lanceur d’applications Linux du Chromebook. Le raccourci démarre le service puis ouvre **http://localhost:3030**. Le Terminal peut être fermé.

Le démarrage automatique s’applique au démarrage de **Linux**. ChromeOS ne démarre pas nécessairement Linux à chaque ouverture de session; lancer Sillage 2 lance l’application Linux. La mise en veille ou l’arrêt du Chromebook peut interrompre l’accès depuis un iPhone.

Pour les prochaines mises à jour, décompressez la nouvelle archive puis exécutez son `Installer Sillage Linux.sh`. Le code est remplacé séparément des données. Aucune fenêtre Chrome n’est ouverte automatiquement par l’installateur; actualisez celle qui est déjà ouverte.

## Où sont les fichiers ?

- Programme : `~/.local/share/sillage/app/`
- Budget actif : `~/.local/share/sillage/data/`
- Copies avant mise à jour : `~/.local/share/sillage/backups/`
- Programme précédent : `~/.local/share/sillage/app.previous/`
- Service utilisateur : `~/.config/systemd/user/sillage.service`

Après une installation réussie, le dossier téléchargé n’est plus le budget actif. Vous pouvez le supprimer en conservant vos sauvegardes. Une défaillance du démarrage lors d’une mise à jour remet le programme et le service précédents en place; les données ne sont pas supprimées. Les copies locales ne remplacent pas une sauvegarde hors du Chromebook.

Pour vérifier le service :

```bash
systemctl --user status sillage.service
journalctl --user -u sillage.service -n 40 --no-pager
```

La migration conserve les fichiers de liens privés présents dans `data`, mais l’adresse Tailscale de l’ancien Mac ne devient pas automatiquement celle du Chromebook. L’accès distant doit être configuré sur le nouvel ordinateur. L’installateur n’installe pas Tailscale et ne publie pas le budget sur Internet.

## Vérifications

Le service systemd et le raccourci sont testés avec des commandes simulées; une copie réellement installée est aussi démarrée sur une base SQLite de test, puis ses soldes, prévisions et tables sont comparés. L’interface est vérifiée sur cinq largeurs et deux thèmes, avec une dépense réellement enregistrée une seule fois. Ces essais Linux ne constituent pas un test sur votre Chromebook physique. Les captures utilisent uniquement des données fictives.
