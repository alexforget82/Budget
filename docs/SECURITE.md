# Vérification de sécurité et robustesse — étape 5

Cette vérification porte sur le code et des serveurs de test isolés. Elle ne certifie pas un hébergement public et ne remplace pas un audit indépendant. Les essais ont lieu sous Linux/Chromium; les outils natifs macOS et le vrai proxy Tailscale doivent encore être vérifiés sur le Mac.

## Frontières d’accès vérifiées

- Le serveur propriétaire local et le backend Tailscale restent sur `127.0.0.1`, avec des ports distincts.
- Le backend privé exige l’identité propriétaire `Tailscale-User-Login`; l’absence d’identité ne donne pas les droits de l’écouteur local. Les identités étrangères et hôtes inattendus sont refusés. Les autres en-têtes de transfert ne donnent pas de privilège.
- Les écritures privées exigent l’origine HTTPS configurée et du JSON. Les écritures locales refusent une origine différente; l’absence d’origine reste permise pour les clients locaux non navigateur. Aucun CORS permissif n’est ajouté.
- Le lien simplifié est un secret de consultation de 64 chiffres hexadécimaux. Ses routes restent distinctes des API du propriétaire. Rotation et révocation sont relues à chaque requête; un fichier de jeton malformé est désormais refusé sans faire échouer les autres routes.
- Les réponses de consultation restent minimales : montants, dates et résultat Oui/Non. Elles ne révèlent pas les descriptions, catégories, comptes et paramètres propriétaires. Le lien doit être protégé comme un accès personnel; aucune authentification propriétaire n’est prétendue sur cette route volontairement partagée.
- Les chemins statiques restent une liste fermée. Une version de ressource peut être ajoutée en query string; cela ne permet pas de lire un module serveur, la base ou un fichier privé.
- Les en-têtes existants contre l’intégration dans une frame, la fuite de référent et le détournement de type MIME sont conservés. La politique CSP actuelle ne constitue pas une liste complète de scripts autorisés.

## Limites de requête

| Routes | Limite |
| --- | ---: |
| Commandes ordinaires | 20 000 octets |
| Routes historiques `featureRoutes`, dont import/restauration | 10 000 000 octets |
| Création/révocation du lien | 1 024 octets |
| Simulation simplifiée | 2 048 octets |

Le lecteur commun mesure les octets du flux, préserve les caractères UTF-8 répartis entre fragments, refuse les objets trop gros avant la validation métier et exige un objet JSON. Le type MIME doit être réellement `application/json`, avec ses paramètres éventuels; `application/jsonx` est refusé. Les limites métier supplémentaires restent applicables : import CSV de 2 Mo et 2 000 opérations, paramètres de scénario bornés, noms et montants validés. Les limites de 20 Ko et 10 Mo n’ont pas été élargies globalement.

## Sauvegardes, restauration et installation

Les migrations restent atomiques et précédées d’un instantané SQLite cohérent incluant le WAL. L’export JSON inclut les tables et métadonnées validées; la restauration est vérifiée en base temporaire puis appliquée atomiquement. Les essais comprennent de vraies restaurations, un redémarrage, la conservation des budgets calendaires et le refus de sauvegardes corrompues.

Le test de retour au code v11.1 ajoute une transaction après mise à jour, puis relance réellement le code figé : la transaction et la prévision restent présentes. Les empreintes de la copie locale sont vérifiées. L’installateur valide maintenant son propre dossier complet avant d’arrêter le service, même si un ancien raccourci de mise à jour l’a lancé.

Les sauvegardes présentes sur le même disque ne couvrent pas une panne ou un vol du Mac. Conserver une copie externe et ne pas synchroniser la base SQLite active à chaud dans iCloud. Une restauration d’un ancien état financier est distincte d’un retour au code précédent.

## Preuves et limites

Les contrôles s’appuient sur les tests privés existants, les nouveaux tests `http-boundaries.test.js`, les tests API `test_v114_*`, les restaurations existantes et `migration-rollback-ui.py`. `security-view-ui.py` vérifie qu’une description et une catégorie contenant du HTML restent du texte inerte dans le registre et l’inspecteur.

Les vérifications ne prouvent pas l’absence de toute vulnérabilité, ne simulent pas un Mac compromis et ne vérifient pas une configuration réelle de pare-feu ou d’employeur. Tailscale Serve est le proxy de confiance; un programme local ayant déjà accès à l’ordinateur et à ses fichiers est hors de cette frontière. Avant un accès public sans Tailscale, il faudrait concevoir et vérifier une authentification et une exploitation adaptées : cette version n’expose pas le budget publiquement.
