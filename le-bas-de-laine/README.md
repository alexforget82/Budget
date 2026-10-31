# Le bas de laine

Première version d’essai **0.3.0**. Une application séparée de Sillage : sa base, son programme et ses liens existants restent intacts. Aucun renseignement bancaire réel n’est livré dans cette archive.

Trois écrans : **Aujourd’hui**, **Transactions**, **Plan**. Un seul compte bancaire principal; cartes et marge comme moyens de paiement sans solde de dette à gérer. Les catégories variables ont une limite à la semaine ou au mois. Pas d’enveloppes à alimenter.

## Maquettes initiales (0.1.0)

Ouvrez **docs/Trois-maquettes.pdf**, ou les fichiers **docs/maquettes/maquette-laine.html**, **maquette-slate.html** et **maquette-paper.html**. Les HTML sont autonomes et s’ouvrent sans serveur; ils sont des aperçus statiques. Avec le serveur lancé, **http://localhost:3040/maquettes** permet de changer la direction visuelle. Toutes les maquettes et captures utilisent des chiffres fictifs.

La direction appliquée à l’application est **Laine et sapin** : crème et vert profond. Un seul thème sombre suit automatiquement le réglage de l’appareil, sans sélecteur ni préférence manuelle.

## Installer sur Chromebook

Prérequis : Linux déjà activé, Node.js **22.13 ou plus récent**, idéalement Node 24. Aucun `npm install`, aucun outil de compilation, aucun CDN.

Dans le dossier décompressé :

```bash
bash "Installer Le bas de laine.sh"
```

Ouvrez ensuite **http://localhost:3040** ou **Le bas de laine** dans le lanceur Linux. Aucun onglet n’est ouvert automatiquement pendant l’installation. Sillage peut rester ouvert sur **3030**.

Le programme est installé dans `~/.local/share/le-bas-de-laine/app`, les données dans `~/.local/share/le-bas-de-laine/data`, et le service s’appelle `le-bas-de-laine.service`. Il fonctionne sans Terminal ouvert. Il démarre avec Linux; ChromeOS ne démarre pas nécessairement Linux tout seul à l’ouverture de session. Le Chromebook doit rester éveillé et connecté pour l’accès à distance.

Pour démarrer sans installation :

```bash
npm start
```

Ce démarrage manuel utilise `data/` dans le dossier courant. Évitez de commencer un vrai budget dans ce mode puis d’installer sans reprendre ce dossier; l’installation utilise son propre dossier stable. Pour transférer un essai manuel, exportez son JSON, puis restaurez-le dans l’installation. Ne pointez jamais `BDL_DATA` vers le dossier Sillage.

## Commencer

Au premier démarrage, choisissez soit **Reprendre Sillage**, soit l’assistant en quatre étapes :

1. Nom et solde réel du compte principal.
2. Chaque prochaine paie à recevoir : montant, fréquence, date.
3. Les prochaines factures fixes. Les catégories variables iront à l’étape suivante.
4. Les limites, avec montant, période et renouvellement. Les exemples Épicerie/Essence/Restaurant sont à modifier ou à décocher.

Ajoutez vos cartes dans **Plan → Moyens de paiement**. Il n’y a aucun solde initial de carte à saisir. Une facture fixe et une limite ne doivent pas protéger la même dépense.

## Le disponible, limites comprises

Le calcul simule chaque journée sur **90 jours**. Le montant principal reste le minimum prévu **avant la prochaine paie**, plafonné à 30 jours comme en 0.1.0. L’alerte « À surveiller » signale un creux supplémentaire sur 90 jours, avec date, montant et facture ou renouvellement lorsqu’ils surviennent ce jour-là. Elle n’affiche pas un deuxième grand chiffre identique s’il n’y a pas de creux supplémentaire. S’il n’y a pas de prochaine paie connue dans les 30 jours, le disponible principal couvre 30 jours et le précise.

Les quatre lignes expliquent le montant principal :

- solde réel du compte, ajusté des opérations entrées après le dernier contrôle;
- achats sur cartes encore à payer;
- factures et mouvements nets prévus jusqu’au jour contraignant;
- restant de la période courante **et de chaque période qui commence avant la paie**, dans la fenêtre de 30 jours.

Une limite n’est jamais un débit bancaire fictif. Un achat sur carte dans une limite diminue son restant et augmente les achats à payer : pas de deuxième déduction. Le paiement de la carte diminue le compte bancaire et libère la protection correspondante. La partie qui dépasse les achats protégés réduit réellement le disponible, comme le remboursement d’une ancienne dette. Un trop-payé n’est pas suivi comme un solde créditeur de carte.

**Exemple testé** : Conjoint 1 000 $, limite Épicerie 230 $, paie le lendemain. Le disponible est 770 $. Un achat de 71,69 $ sur carte laisse 158,31 $ dans la limite et protège 71,69 $ pour la carte : toujours 770 $. Son remboursement complet ramène le Conjoint à 928,31 $, sans changer ces 770 $.

Sans paie entre les renouvellements, chacun des prochains jeudis protège 230 $ supplémentaires. Une prévision n’assume pas que les limites non dépensées auront été consommées sur votre compte bancaire : elle les garde protégées. Une nouvelle période réelle repart de sa limite; il n’y a pas de report de budget inutilisé.

Un achat anticipé peut être imputé à **la prochaine période** à la saisie, en conservant sa vraie date. La prochaine période protège alors sa limite moins cet achat. Les catégories sans limite restent disponibles pour classer les achats.


Dans l’assistant, **Autres** propose un coussin modifiable de **50 $ par mois**, que vous pouvez décocher. Il couvre les achats sans catégorie ou dans une catégorie sans limite propre. Les factures associées, les virements et les revenus sans catégorie n’en consomment pas le montant. Les catégories choisies restent visibles dans Transactions. Cette réserve n’est pas ajoutée aux budgets existants automatiquement : dans Plan, ajoutez une limite nommée Autres pour l’activer; la catégorie existante est réutilisée.

Touchez **Limites protégées** dans les quatre lignes : le détail indique le restant actuel et les renouvellements inclus, avec leur date et les achats déjà imputés. Son total correspond exactement à la ligne. Le calcul est daté du jour qui détermine le minimum avant la paie; il ne prétend pas que tous les montants sont débités aujourd’hui.

## Factures, solde et transactions

**Payée / Reçue / Effectué** enregistre l’opération et règle l’échéance ensemble. **Montant…** permet de modifier uniquement cette échéance. **Reporter** garde l’obligation à une nouvelle date. Une facture passée non résolue continue de réduire le disponible. Une paie attendue aujourd’hui n’est pas ajoutée avant d’être marquée reçue; les paies futures restent des prévisions.

Le bouton **Vérifier mon solde** affiche l’écart et remplace le point de départ bancaire. L’ordre de saisie détermine les opérations déjà incluses : les achats de carte à payer restent protégés. Une modification d’une opération bancaire antérieure à ce point ne réécrit pas le solde réel que vous avez confirmé.

Les achats se corrigent avec **Modifier** dans Transactions. Un paiement de carte s’enregistre comme **Paiement de carte / virement**, jamais comme une nouvelle dépense. La version d’essai ne propose pas encore la modification ou la suppression des virements : vérifiez leur montant avant d’enregistrer et corrigez un essai via restauration au besoin.

## Import CSV

Dans Transactions : **Importer un CSV**. Formats pris en charge : CSV virgule/point-virgule/tabulation, dates ISO ou JJ/MM/AAAA, montant signé à deux décimales. Trois colonnes sont demandées si les en-têtes ne sont pas reconnus.

Choisissez **Déjà dans le solde bancaire** pour l’historique : les achats réduisent tout de même la limite de catégorie. Pour une carte, choisissez séparément si les achats sont encore à payer ou déjà payés. Un solde bancaire vérifié ne renseigne pas cette dette de carte.

L’aperçu signale les lignes déjà présentes, les erreurs et les factures ouvertes qui pourraient correspondre. Pour une suggestion, choisissez la facture ou **Nouvelle opération** avant d’importer. Une même ligne ne peut pas être appliquée deux fois dans une validation. Le repérage des doublons utilise compte, date, montant et description; un fichier contenant deux vraies opérations strictement identiques demande une vérification manuelle.

## Reprendre Sillage et comparer

Exportez une **sauvegarde JSON complète** depuis Sillage. L’export pour ChatGPT n’est pas un fichier de restauration. Le premier import se fait dans une nouvelle base vide; l’assistant offre ce choix avant toute configuration.

L’import préserve les identifiants source. Réimporter exactement la même sauvegarde est sans effet; un changement source met à jour sa ligne existante. Les conflits d’édition et les suppressions source sont signalés, sans écrasement silencieux. Des opérations ajoutées localement bloquent la reprise d’une nouvelle sauvegarde, pour ne pas remplacer leur effet sur le solde. Pendant l’essai parallèle, continuez donc à saisir **dans Sillage seulement**.

Les enveloppes variables hebdomadaires/mensuelles sont reprises comme limites. Certains mécanismes anciens n’ont pas d’équivalent direct : paiement d’enveloppe à date précise, autre fréquence de limite, règles de financement, report du restant, calendriers particuliers d’enveloppe. Les champs connus mais non repris sont signalés. Un import avec règles manquantes affiche **Disponible à vérifier**, également dans la vue partagée. Le montant ne doit pas être utilisé comme budget validé tant que ces points ne sont pas réglés.

Le script de comparaison exécute le code Sillage installé sur une **copie temporaire** restaurée depuis le JSON, à la date de référence fixée. Il ne démarre jamais Sillage sur votre dossier de données réel. La nouvelle simulation est aussi temporaire :

```bash
node compare.js /chemin/vers/sauvegarde.json --date 2026-10-30 --output comparaison.json
```

Remplacez la date par celle de votre copie figée. Le programme Sillage est cherché dans `~/.local/share/sillage/app`; sinon utilisez `--sillage-dir /chemin/vers/le/programme/Sillage`. Le rapport reste local et contient vos montants : partagez seulement les éléments que vous souhaitez faire examiner.

Le rapport compare chaque jour sur 90 jours, avec solde, cartes, limites et disponible, puis les deux indicateurs. Il ne désigne jamais automatiquement un moteur fautif. Les écarts non expliqués restent **à examiner** et empêchent la validation. Après analyse, un fichier passé à `--decisions decisions.json` peut les classer en règle volontairement différente, erreur de Sillage ou erreur de la nouvelle application, avec explication obligatoire. Le code de sortie est 0 si validé, 2 s’il reste une différence ou une règle bloquante, 1 si le contrôle ne peut pas s’exécuter.

## iPhone, pour vous et votre conjointe

Après installation et connexion Tailscale dans Linux :

```bash
bash "Configurer acces iPhone.sh"
```

Le script affiche la nouvelle adresse privée, sur **HTTPS 8443**. Il garde l’accès Sillage sur 443 et refuse d’écraser un autre service utilisant 8443. Si Tailscale demande d’activer Serve dans sa console, faites-le puis relancez le script.

Sur l’iPhone, connectez Tailscale, ouvrez cette adresse dans Safari puis utilisez **Partager → Sur l’écran d’accueil**. L’accès complet exige votre identité Tailscale. Pour votre conjointe, créez un **lien de lecture** dans **Plan → Réglages et sauvegardes**. Il montre le même calcul, les limites et les journées, sans accès aux formulaires ni à l’export complet. Un manifeste distinct conserve son lien lors de l’ajout à l’écran d’accueil. Ce lien peut être révoqué. Aucun accès public Funnel n’est activé.

## Sauvegarder, restaurer et revenir à Sillage

Une copie SQLite cohérente est conservée au premier usage configuré de la journée, puis lors du changement de jour tant que le serveur fonctionne. Les fichiers sont dans `data/backups`. Un export manuel JSON et une restauration sont dans Plan; une copie est conservée avant restauration, import ou réinitialisation.

**Réinitialiser l’essai** efface seulement la nouvelle base après confirmation **EFFACER** et sauvegarde. Cela permet de tester les exemples puis de repartir de votre JSON Sillage. Ne supprimez aucun dossier Sillage.

L’installation conserve le programme précédent dans `app.previous` et une copie de ses données avant mise à jour. Pour rester sur Sillage, continuez simplement à ouvrir son adresse habituelle : aucune désinstallation du Bas de laine n’est nécessaire. N’arrêtez Sillage qu’après comparaison expliquée et deux à quatre semaines d’essai; cette durée n’est pas remplacée par les tests automatiques.

## Technique et vérifications

Node.js + SQLite natif, huit tables, schéma `migrations/001-initial.sql`, `PRAGMA user_version=1`. Moteur pur indépendant de Sillage; seul le calendrier bancaire Canada/Québec réutilise une fonction pure éprouvée du projet précédent. La comparaison charge le programme Sillage externe uniquement pour la référence temporaire.

```bash
npm test
python3 tests/ui.py  # développeur : Playwright et Chromium requis
```

Les tests utilisent des données fictives. Le test de comparaison réelle au code Sillage peut être omis si ce programme n’est pas disponible. Les tests systemd vérifient le vrai analyseur, mais pas un Chromebook physique. Le parcours responsive a été vérifié dans Chromium; pas de test matériel Safari iOS, de connexion bancaire ou de validation sur vos données réelles. Voir `docs/TESTS.md` et `docs/SPECIFICATION.md`.

## Dates des paies et factures

Dans l’assistant et dans Plan, « Week-ends et jours fériés » permet de conserver la date ou de choisir le jour ouvrable précédent ou suivant. Le calendrier bancaire utilisé est Québec/Canada. Un aperçu affiche la prochaine date dans l’assistant et les trois prochaines dans le formulaire complet.

« Dernier jour du mois » et « Dernier jour ouvrable du mois » sont deux fréquences distinctes. Une récurrence mensuelle au 31 revient au dernier jour des mois plus courts, sans dériver les mois suivants. Les ajustements conservent l’ancrage de la récurrence. Les échéances déjà payées et les reports manuels sont conservés lors d’un changement compatible de calendrier; les dates des achats réels ne changent pas.

Les règles existantes ne sont pas déplacées automatiquement. Les limites de catégorie gardent leur date de renouvellement budgétaire; elles ne sont pas des paiements bancaires. Les dates RRQ demeurent estimées et doivent être confirmées avec le calendrier officiel de Retraite Québec.
