# Étapes 2 à 5 — relevé de validation

Livraison : **v11.4.0**. Réorganisation technique et corrections des frontières HTTP; les calculs et l’apparence sont conservés.

La référence est la v11.3 officielle, commit `731a58b68532e67ac9f63e6765752db34ee32d9c`. Aucun dossier financier privé du Mac n’est accessible depuis cet environnement. Tous les essais utilisent des bases temporaires fictives.

## Vérifications

- `npm test` : **80 tests Node et 183 tests API réussis**, aucun ignoré.
- **55/55 scripts Python réussis** dans la dernière exécution complète. Les résultats sont consignés dans [phases-2-5-results.json](phases-2-5-results.json).
- `refactor-parity-ui.py` compare les mêmes données avec le vrai code v11.3 : tables financières, réserves, comptes, transactions, planification et prévision canonique de 90 jours identiques. Styles visibles identiques sur dix écrans × deux thèmes × deux largeurs = **40 combinaisons**.
- Les essais comprennent la copie installée, le cycle simulé du service Mac, la restauration effective d’une sauvegarde avec redémarrage et le retour effectif au code v11.1 en conservant une transaction créée après mise à jour.
- Les frontières privées, les limites JSON en octets, les types MIME, les jetons de consultation et l’affichage inerte des libellés HTML ont été vérifiés.

## Réparation des tests historiques

Les sélecteurs ont été adaptés aux menus mobiles, aux sections détaillées repliées, aux éditeurs devenus des dialogues et aux numéros de version actuels. Les assertions financières sont maintenues. La première passe complète donnait 54/55 : le scénario de rappel marchand ressaisissait pendant la fin du traitement asynchrone de l’enregistrement. Son test attend maintenant explicitement la fin du gestionnaire de soumission avant de rouvrir l’éditeur, sans modifier l’application. Une seconde passe a révélé une course lors du passage au format mobile : le test vérifie désormais le format demandé et ouvre les outils avant de cliquer sur une action qui s’y déplace. Le scénario corrigé passe également.

## Limites et choix conservateurs

Les tests de navigateur utilisent Chromium sous Linux. Le comportement natif de Safari/iOS, Gatekeeper, `launchd` et un vrai Tailscale Serve reste à vérifier sur le Mac. Les tests HTTP vérifient la frontière d’identité attendue, pas la configuration du réseau de l’utilisateur.

Les anciens points d’accès JavaScript restent disponibles par un pont de compatibilité; les anciennes URL CSS redirigent vers les nouveaux fichiers. Trois priorités `!important` redondantes sont retirées; les autres sont conservées pour préserver les styles. Il ne s’agit pas d’une réécriture des règles financières ni d’une refonte mobile.

Le schéma SQLite reste à la version 1. Le [retour à la v11.1](RETOUR-11.1.md) et les sauvegardes de code et de données restent disponibles.
