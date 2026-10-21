# Sillage 13.1.2 — utiliser le budget de demain pour un achat anticipé

Le menu « Associer au prévu » ne proposait que les dépenses et revenus programmés. Un renouvellement de budget réservé n’est pas une dépense; il n’apparaissait donc pas dans ce menu. Cette limite est corrigée sans transformer le budget en débit bancaire.

Après mise à jour, pour l’achat d’épicerie de 71,69 $ du 21 octobre destiné au budget de 230 $ du 22 :

1. Ouvrez **Transactions → … → Associer au prévu** sur cet achat.
2. Choisissez **2026-10-22 · Épicerie · Budget réservé**.
3. La fiche affiche **Restant du budget du 22 octobre : 158,31 $**. La vue simplifiée utilise aussi ce restant pour la période à venir.

La dépense conserve sa date réelle, le compte n’est pas débité une seconde fois, la réserve actuelle n’est pas alimentée fictivement et la période reste ouverte pour les autres achats. Le budget habituel demeure 230 $; le restant de la période est un autre montant. Les achats sur carte conservent leur protection existante jusqu’au remboursement.

Les périodes proposées sont celles prévues dans les sept jours suivant la transaction, pour son enveloppe protégée et son compte admissible. Une transaction déjà utilisée ne peut pas être associée une seconde fois. Si les données changent entre le choix et la confirmation, rouvrez la liste. Pour les enveloppes de paiement daté, le parcours de confirmation existant reste disponible.

Sans association volontaire, un achat passé ne consomme toujours pas automatiquement le premier budget futur : le correctif 13.1.1 est conservé.

Téléchargez [la v13.1.2](https://github.com/alexforget82/Budget/archive/refs/tags/v13.1.2.zip), décompressez-la, puis utilisez **Applications → Sillage → Mettre a jour Sillage.command**. Choisissez le nouveau dossier complet, actualisez Safari et vérifiez v13.1.2. Aucun nouveau lien iPhone ni changement de date de transaction n’est nécessaire.

[Contrôles](../TESTS.md) · [Relevé](v1312-checks.json). Les exemples et essais utilisent des données fictives. La validation visuelle sur un véritable iPhone reste à faire.
