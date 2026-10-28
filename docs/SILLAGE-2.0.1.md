# Sillage 2 — correctif 16.0.1

## Cause et correction

L’installateur 16.0.0 utilisait le même échappement pour `WorkingDirectory` et les arguments de `ExecStart`. systemd interprète les guillemets du premier comme des caractères du chemin et refuse le service avec « WorkingDirectory= path is not absolute ». La 16.0.1 écrit ce chemin sans guillemets englobants, protège les spécificateurs `%` et rejette les retours à la ligne. Les arguments de commande gardent leur propre échappement.

Le nouveau test appelle réellement `systemd-analyze verify`. Il reproduit le refus de l’ancien format, puis valide le service généré, y compris avec des espaces, un pourcentage et un dollar dans le chemin. Le démarrage d’un gestionnaire systemd complet sur Chromebook reste à confirmer sur l’appareil.

La recherche des bases inclut maintenant tous les dossiers versionnés `~/Applications/Budget-X.Y.Z/data`. Si plusieurs existent, aucun choix silencieux n’est fait : `--import-data` est nécessaire. Une installation stable existante garde sa propre base. Ni les moteurs financiers ni le format SQLite ne changent.

## Réparer après un échec de la 16.0.0

Conservez les anciens dossiers et les copies `failed-import`. Vérifiez d’abord quelle base contient vos données habituelles. Si le budget actuellement utilisé est celui du dossier `Budget-16.0.0`, arrêtez son `npm start` avec Ctrl+C dans son Terminal, puis exécutez :

```bash
(
set -e
mkdir -p ~/Applications
cd ~/Applications
curl -fL https://github.com/alexforget82/Budget/archive/refs/tags/v16.0.1.zip -o Sillage-2.0.1.zip
unzip -o Sillage-2.0.1.zip
cd Budget-16.0.1
bash "Installer Sillage Linux.sh" --import-data "$HOME/Applications/Budget-16.0.0/data"
systemctl --user is-active sillage.service
)
```

Le résultat final attendu est `active`. Le dossier source n’est pas supprimé. Si vos vraies données sont dans une autre base, remplacez uniquement le chemin après `--import-data` par celui de cette base. N’utilisez pas `--new` pour cette réparation.

Si Sillage est déjà installé et fonctionne dans `~/.local/share/sillage/data`, lancez le nouvel installateur sans `--import-data` pour une mise à jour ordinaire.

Une fois le service actif et les chiffres vérifiés sur http://localhost:3030, reprenez la configuration Tailscale du Chromebook. La configuration privée utilise le dossier stable `~/.local/share/sillage/data` et le port privé 3031.
