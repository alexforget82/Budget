# Sillage 2 — 16.1.0

Le Conjoint reste le compte bancaire qui définit le disponible. Les cartes et la marge peuvent devenir de simples moyens de paiement, sans dette à saisir ou à rapprocher. Les comptes existants ne changent pas automatiquement.

## Utilisation

1. Dans **Réglages → Comptes**, ajoutez une carte ou une marge. Choisissez **Crédit / marge**, puis laissez **Sans suivi du solde** coché. Aucun montant initial n’est demandé. Pour un compte existant, utilisez **Modifier** pour choisir ce mode.
2. Lors d’un achat, choisissez le moyen de paiement et, si nécessaire, l’enveloppe. La catégorie peut être proposée comme avant. Un nouvel achat sur un moyen de paiement sans solde protège son montant, même sans enveloppe.
3. Une enveloppe protège automatiquement son budget selon son renouvellement. Un achat couvert diminue le restant de l’enveloppe et garde l’argent nécessaire au paiement de la carte protégé : pas de deuxième déduction du disponible.
4. Pour rembourser, cliquez **Payer cette carte**, indiquez le montant réel et vérifiez l’aperçu. Le solde du Conjoint baisse et la protection payée est libérée. Ne saisissez pas aussi une dépense pour ce même remboursement. Le bouton propose les achats encore protégés, sans prétendre connaître le paiement exigé par la banque.
5. Un remboursement d’ancienne dette ou un paiement supérieur aux achats protégés consomme du disponible pour sa partie non couverte. Sillage ne connaît ni votre dette totale ni votre minimum bancaire; consultez votre banque pour ces informations.

Exemple : avec 1 000 $ au Conjoint et une enveloppe Épicerie de 230 $, le disponible est 770 $. Après 71,69 $ d’épicerie sur carte, le restant est 158,31 $ et 71,69 $ sont protégés pour la carte : disponible toujours 770 $. En payant ces 71,69 $ depuis le Conjoint, le solde bancaire devient 928,31 $ et le disponible reste 770 $.

Le mode garde le journal technique nécessaire aux corrections et aux paiements, mais ne présente pas ce journal comme un solde bancaire de carte. L’historique n’est ni effacé ni réinitialisé. Les anciens achats sans enveloppe ne sont pas réservés rétroactivement. Les nouveaux imports qui affectent les soldes suivent la protection; les imports historiques ne la créent pas. Les achats sont toujours enregistrés à leur date réelle. La convention existante reste la même : les achats d’une journée sont considérés avant les remboursements de cette journée.

Si un ancien compte contient des achats d’enveloppe dont la protection a été limitée par un solde rapproché, sa conversion pourrait réactiver des réserves anciennes. L’application refuse ce changement sans modifier le compte : conservez le suivi de ce compte pour cet historique. Cela évite de changer silencieusement le disponible. Les renouvellements et les règles d’association existants ne sont pas modifiés.

## Mettre à jour sur Chromebook

Cette procédure vise une installation stable existante dans `~/.local/share/sillage`, comme la 16.0.1. Dans le Terminal Linux :

```bash
(
set -e
mkdir -p ~/Applications
cd ~/Applications
curl -fL https://github.com/alexforget82/Budget/archive/refs/tags/v16.1.0.zip -o Sillage-16.1.0.zip
unzip -o Sillage-16.1.0.zip
cd Budget-16.1.0
bash "Installer Sillage Linux.sh"
)
```

Actualisez ensuite l’onglet déjà ouvert. L’installateur conserve le dossier de données stable et les réglages d’accès privé. Il crée une copie avant remplacement et garde le programme précédent dans `app.previous`. Aucune nouvelle fenêtre de navigateur n’est ouverte. Tailscale Serve conserve sa configuration sur le port privé 3031; les liens iPhone restent valides.

Avant la mise à jour, vous pouvez aussi exporter un JSON dans **Réglages → Sauvegardes** et le conserver hors du Chromebook. Pour revenir au programme précédent, réinstallez le ZIP 16.0.1 avec son installateur Linux sur le même dossier stable; le schéma SQLite n’a pas changé. Les nouveaux achats et le nouveau paramètre restent sauvegardés, mais l’ancien programme ne connaît pas la protection supplémentaire des achats sans enveloppe : son disponible ne doit donc pas servir de référence pour ces achats. Pour retrouver exactement l’état antérieur, restaurez aussi la copie JSON exportée avant mise à jour; les saisies faites depuis seront alors à reprendre.

## Vérifications

Tests sur bases temporaires : nouveaux achats avec ou sans enveloppe, achats récurrents, paiements partiels et complets, remboursements commerçants, anciennes dettes, correction/suppression, import CSV réel/historique, restauration et redémarrage, partage du disponible. Navigation et paiements vérifiés dans Chromium aux largeurs iPhone et ordinateur. Ces contrôles ne remplacent pas un essai sur votre Chromebook ou dans Safari iOS.
