# Questions dans ChatGPT — v11.4.3

Dans **Outils et réglages → Poser une question à ChatGPT** :

1. Choisir la période de l’historique et, si souhaité, ouvrir l’aperçu.
2. Télécharger le fichier JSON préparé.
3. Ouvrir ChatGPT, joindre le fichier et poser sa question. Il peut aussi être joint à une conversation existante.

Aucune clé API, aucun appel automatique à OpenAI et aucune intégration payante ne sont utilisés. L’utilisateur choisit lui-même de joindre le fichier dans ChatGPT, selon les possibilités de son forfait.

## Contenu et portée

L’export comprend les comptes et leurs soldes enregistrés, catégories/sous-catégories, enveloppes et exceptions, récurrences, rapprochements, remboursements programmés, budgets et sous-budgets, transactions et virements de la période choisie, avertissements et prévisions canoniques. Les montants sont en cents CAD, avec des consignes pour ne pas déduire les réserves ou les transactions une deuxième fois.

L’historique couvre 90 jours, 365 jours ou toutes les opérations enregistrées. Les budgets couvrent les trois mois précédant le mois courant, le mois courant et les trois suivants. Les prévisions couvrent les 90 prochains jours, avec les minima/maxima de 30/60/90 jours. Le fichier précise les périodes, les nombres de transactions et sa date de génération. Les opérations déjà saisies dans le futur restent signalées.

Il s’agit d’un instantané des données de Sillage, sans connexion en direct au logiciel ou aux banques. Il faut préparer un nouveau fichier après une modification. Les données saisies peuvent être incomplètes. Ce fichier n’est pas une sauvegarde restaurable.

## Accès et partage

La route GET propriétaire `/api/chatgpt/export?history=90` applique la même authentification que le reste du budget. Le lien de consultation simplifiée et une autre identité Tailscale n’y donnent pas accès. L’export est construit par une liste explicite de champs financiers; il ne copie pas une sauvegarde complète, la configuration, les jetons, les liens privés ou les chemins de fichiers.

Le fichier est préparé localement par le serveur. Le navigateur permet de lire son contenu comme du texte et de télécharger exactement ce contenu. Il est régénéré lorsqu’on change de période. Fermer le dialogue efface l’aperçu et libère le fichier temporaire en mémoire. En cas d’erreur, aucun ancien fichier n’est proposé au téléchargement.

Le lien vers `https://chatgpt.com/` ne contient aucun montant ni paramètre, s’ouvre sur action explicite et n’envoie pas de référent ou de lien avec la fenêtre Sillage. La préparation du fichier ne provoque aucune requête externe. Les noms, libellés et montants financiers sont volontairement conservés pour permettre l’analyse; leur partage se fait uniquement quand l’utilisateur joint le fichier.

## Validation

- 97 tests Node et 188 tests API réussis.
- Tests spécifiques : sélection de l’historique, montants canoniques, exclusions des champs privés à plusieurs niveaux, aucun changement des tables, refus par la vue simplifiée et l’identité privée non propriétaire.
- Interface : ordinateur et largeur iPhone, clair et sombre, aperçu, changement de période, contenu téléchargé identique, panne puis nouvelle tentative, lien externe sans données ni accès à la fenêtre d’origine. Seule la préférence de thème change volontairement pendant ce test.
- Copie installée, service Mac simulé et comparaison historique de 40 combinaisons de styles et calculs inchangés réussis.

La suite Python complète n’a pas été relancée pour cette version : les parcours pertinents ci-dessus ont été exécutés. Chromium sous Linux, données fictives; Safari/iOS et le vrai Mac restent à vérifier. Les règles financières de la v11.4.2 sont conservées.
