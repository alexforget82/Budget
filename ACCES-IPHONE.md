# Mon Budget sur votre iPhone — accès privé depuis votre Mac

Les données restent dans le dossier `data` de votre Mac. Le Mac et l’iPhone consultent **la même base**, sans serveur d’hébergement à louer. Le Mac doit rester allumé et connecté à Internet. Le budget n’est pas publié sur le Web public.

## Recommandé : fonctionner sans fenêtre Terminal — v3.7

Une installation unique permet de fermer Terminal et de démarrer le budget automatiquement à **l’ouverture de votre session Mac**. Tailscale doit lui aussi être connecté sur le Mac; activez son ouverture à la connexion dans ses réglages. Après un redémarrage, ouvrez votre session au moins une fois, puis vous pouvez verrouiller le Mac.

### Première installation

1. Dans l’ancienne fenêtre **Acces prive iPhone.command**, faites **Control + C** pour arrêter le serveur. Laissez Tailscale connecté.
2. Gardez une copie complète de votre dossier actuel. Téléchargez le nouveau ZIP et décompressez-le dans un nouveau dossier.
3. Copiez votre dossier **data** actuel dans ce nouveau dossier, à côté de `server.js`.
4. Double-cliquez sur **Installer acces automatique.command**. Le programme vérifie Tailscale, installe le budget et ouvre son adresse privée.
5. Quand le message indique que le budget fonctionne en arrière-plan, vous pouvez fermer Terminal. Vérifiez l’accès depuis Safari sur l’iPhone.

Le budget est installé dans **`~/Library/Application Support/Mon Budget`**. Sa base active devient **`~/Library/Application Support/Mon Budget/data/budget.sqlite`**. Le dossier téléchargé sert uniquement d’installateur; son ancienne copie des données n’est plus la base utilisée. Ne lancez plus `npm start` ni l’ancien lanceur depuis un autre dossier en parallèle.

### Mises à jour suivantes

Téléchargez et décompressez la nouvelle version, puis double-cliquez sur **Installer acces automatique.command** dans ce nouveau dossier. Il n’est plus nécessaire de recopier `data`. Le programme arrête son service, sauvegarde la base active, remplace les fichiers de l’application et redémarre la nouvelle version. Il réutilise toujours les données du dossier fixe, même si une copie de `data` se trouve dans le ZIP décompressé.

**Copier des fichiers ou télécharger un ZIP ne déclenche pas de code automatiquement.** Il faut lancer ce fichier pour appliquer une mise à jour. Le démarrage à l’ouverture de session, lui, est automatique. Cette version ne télécharge aucune mise à jour toute seule.

### Arrêter ou désactiver

Double-cliquez sur **Desactiver acces automatique.command**, fourni dans le ZIP. Le budget s’arrête et son démarrage automatique est supprimé. Vos données restent intactes dans le dossier fixe. Tailscale reste connecté; son relais ne peut plus joindre le serveur arrêté. Pour réactiver le budget, relancez l’installateur; il réutilise vos données du dossier fixe.

Les sauvegardes avant installation/mise à jour se trouvent dans **`~/Library/Application Support/Mon Budget/data/backups`**. Les journaux de diagnostic sont dans **`~/Library/Logs/Mon Budget`** (`budget.log` et `budget-error.log`). Le service utilise un agent personnel `~/Library/LaunchAgents/ca.monbudget.private.plist`, sans mot de passe administrateur, et garde le Mac éveillé contre la veille automatique. Le Mac doit rester alimenté, connecté et **couvercle ouvert**. Une fermeture de session ou l’arrêt du Mac interrompt l’accès.

Le cycle d’installation a été testé avec un `launchctl` simulé et un vrai serveur/base temporaire. L’installation effective de l’agent macOS, les permissions et le redémarrage de session restent à vérifier sur votre Mac.

Les étapes ci-dessous décrivent aussi l’ancien **mode manuel**, qui nécessite de garder Terminal ouvert. Choisissez un seul mode à la fois.

## 1. Installer Tailscale sur vos deux appareils

- Sur le **Mac**, installez Tailscale depuis [le site officiel](https://tailscale.com/download), ouvrez-le et connectez-vous à votre compte personnel.
- Sur l’**iPhone**, installez Tailscale depuis l’App Store, connectez-vous **au même compte** et autorisez la connexion VPN demandée par iOS.
- Connectez les deux appareils dans Tailscale. Ne partagez pas votre compte de connexion.

L’accès privé utilise Tailscale Serve et une adresse HTTPS en `.ts.net`. Tailscale peut demander l’activation de MagicDNS et des certificats HTTPS dans sa console. Le lanceur affiche le lien d’activation fourni par Tailscale, si nécessaire. Les services et conditions de Tailscale sont distincts de Mon Budget.

## 2. Mettre Mon Budget à jour

1. Arrêtez l’ancien serveur avec **Control + C** dans sa fenêtre Terminal.
2. Gardez une copie complète de votre ancien dossier, avec `data` et les éventuels fichiers SQLite `-wal` / `-shm`.
3. [Téléchargez le ZIP actuel](https://github.com/alexforget82/Budget/archive/refs/heads/main.zip) et décompressez-le dans un **nouveau dossier**.
4. **Copiez** votre ancien dossier `data` dans ce nouveau dossier, au même niveau que `server.js`. Gardez l’original intact.
5. Conservez tous les fichiers applicatifs ensemble, notamment `private-access.js`.

## 3. Ouvrir l’accès privé sur le Mac

Double-cliquez sur **Acces prive iPhone.command** dans le nouveau dossier. Si nécessaire, faites clic droit → Ouvrir. Si le fichier n’est pas exécutable, dans Terminal au même endroit :

```sh
chmod +x "Acces prive iPhone.command"
```

Le lanceur :

- Retrouve le nom HTTPS du Mac et l’identité du compte connecté à Tailscale.
- Prépare `data/private-access.json` pour ce compte. Il ne contient aucun mot de passe et reste dans votre dossier privé; ne le publiez pas.
- Lance le budget, ou vérifie qu’une instance compatible du bon budget est déjà ouverte.
- Configure **Tailscale Serve**, sans activer **Funnel**, et affiche votre adresse HTTPS personnelle.
- Garde le Mac éveillé contre la veille automatique lorsqu’il a lancé le serveur. Le Mac peut être verrouillé et son écran éteint.

Gardez la fenêtre Terminal du serveur ouverte. **Control + C** arrête le serveur lancé par ce fichier et rend alors le budget inaccessible à distance. Après un redémarrage du Mac, relancez ce fichier. Ce mode manuel ne démarre pas automatiquement; utilisez l’installateur ci-dessus pour le mode automatique.

Gardez le Mac alimenté et le couvercle ouvert. Fermer le couvercle, mettre le Mac en veille ou le déconnecter d’Internet peut interrompre l’accès, même si le lanceur empêchait la veille automatique. Si le lanceur réutilise un serveur déjà ouvert, réglez aussi la veille dans les réglages du Mac.

Le lanceur ne remplace pas une autre configuration Tailscale Serve et refuse une configuration comportant déjà un Funnel. Si un autre service existe, gardez le message affiché pour adapter l’installation; n’utilisez pas `tailscale serve reset` pour effacer des services existants.

## 4. Ouvrir le budget sur l’iPhone

1. Vérifiez que **Tailscale est connecté** sur l’iPhone.
2. Dans **Safari**, ouvrez **l’adresse HTTPS affichée par le lanceur sur le Mac**. N’utilisez pas `127.0.0.1` sur l’iPhone : cette adresse désignerait l’iPhone lui-même.
3. Vérifiez vos comptes et soldes, puis essayez une consultation depuis le réseau cellulaire pour confirmer l’accès hors de la maison.
4. Pour un raccourci : Safari → **Partager → Sur l’écran d’accueil**.

Après une modification sur l’autre appareil, actualisez la page pour charger les derniers montants. Il s’agit d’un accès à la même base, pas d’une synchronisation de deux copies indépendantes. Aucun cache hors ligne des données financières n’est ajouté; si le Mac ou Tailscale est déconnecté, le budget n’est pas accessible depuis l’iPhone.

Les sauvegardes restent celles de Mon Budget sur le Mac. Exportez régulièrement une sauvegarde JSON et conservez aussi une copie privée de votre dossier `data`.

## Accès et vérifications

Le serveur conserve son interface locale `127.0.0.1:3030`. Le relais privé utilise **un second port sur la boucle locale, 3031**, et refuse toute requête sans l’identité propriétaire fournie par Tailscale Serve. Ce port ne sert pas directement sur Internet. Le budget vérifie aussi l’origine HTTPS exacte des écritures. Aucun port ne doit être ouvert sur le routeur.

La protection distante dépend du relais Tailscale Serve et de l’intégrité du Mac. N’exposez aucun des ports du budget par une redirection de routeur, un autre tunnel public ou Tailscale Funnel. Le lanceur ne le fait pas. L’accès local reste destiné à votre Mac de confiance.

Les contrôles automatisés vérifient les accès autorisés/refusés, l’origine des écritures, les ports distincts, le fonctionnement local et l’interface dans Chromium. **L’installation Tailscale réelle, les permissions macOS et Safari/iPhone ne peuvent pas être activés ou vérifiés depuis l’environnement de développement.** Ils restent à effectuer sur vos appareils. Les commandes exactes prises en charge peuvent dépendre de votre version Tailscale; conservez les messages si une étape refuse de démarrer.
