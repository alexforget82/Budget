# Sillage 13.1.1 — budget de la première période

Une dépense associée à une enveloppe avant sa date de début pouvait être comptée automatiquement comme une avance sur la première période. C’est la cause du renouvellement à 0 $ dans le cas décrit : Essence Alex, dépense de 60 $ le 20 octobre, début hebdomadaire le 27.

Après correction, choisir une enveloppe dans une transaction passée ne constitue plus une association à son premier budget futur. Ce budget reste à protéger à sa date. Une association explicite à une occurrence future continue de représenter un achat anticipé volontaire. Le financement anticipé conserve ses règles.

Le correctif s’applique à toutes les enveloppes, dans la prévision comme dans le renouvellement réel. Aucune transaction existante ni aucun solde bancaire n’est réécrit. Les chiffres de prévision sont recalculés après mise à jour; aucun besoin de supprimer puis recréer la dépense du 20.

Téléchargez [la v13.1.1](https://github.com/alexforget82/Budget/archive/refs/tags/v13.1.1.zip), décompressez-la et utilisez **Applications → Sillage → Mettre a jour Sillage.command** avec le nouveau dossier. Actualisez Safari et vérifiez v13.1.1. Les liens iPhone restent valides.

Les nouveaux tests distinguent une simple association à l’enveloppe d’une association explicite à la période. [Vérifications](../TESTS.md).
