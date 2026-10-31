# Calendrier de traitement — 0.4.1

Validation du 31 octobre 2026 à partir des tableaux fournis dans la conversation. Les pages sources n’ont pas été téléchargées avec succès (HTTP 403). Le premier tableau identifie les fermetures 2026; le second distingue, pour 2027, congé légal et « Payment System Closure » et contient des références Powerpay. Les tests comparent les valeurs reçues, sans certifier l’origine ou l’exactitude externe du copier-coller.

| Fermeture | 2026 | 2027 |
| --- | --- | --- |
| Nouvel An | 1 janvier | 1 janvier |
| Vendredi saint | 3 avril | 26 mars |
| Fête de la Reine | 18 mai | 24 mai |
| Fête du Canada | 1 juillet | 1 juillet |
| Fête du Travail | 7 septembre | 6 septembre |
| Vérité et réconciliation | 30 septembre | 30 septembre |
| Action de grâce | 12 octobre | 11 octobre |
| Souvenir | 11 novembre | 11 novembre |
| Noël | 25 décembre | 27 décembre |
| Lendemain de Noël | 28 décembre | 28 décembre |

Les deux listes générées correspondent exactement, sans date supplémentaire. Le tableau 2027 indique aussi le Nouvel An 2028 observé le 3 janvier : cette date est fermée, donc un paiement décalé après le 1 janvier 2028 est traité le 4 janvier.

## Périmètre

Le **24 juin reste férié au Québec**, mais n’est pas une fermeture nationale de paiement. Sont aussi exclus le lundi de Pâques, les congés provinciaux/sectoriels et la fermeture propre à Dayforce le premier lundi d’août. Cela ne prédit pas les décisions de paie particulières d’un employeur. Le champ de déplacement reste modifiable; les dates RRQ demeurent estimées.

## Correction des anciennes échéances

Les versions précédentes ajoutaient le 24 juin et son report observé. La compatibilité historique permet de retrouver les anciennes clés, puis de les convertir par numéro d’occurrence. L’état payé/annulé/reporté, les montants particuliers, reports manuels et liens aux transactions/virements sont conservés. Aucune date de transaction n’est changée. Une collision bloque la conversion. Une sauvegarde SQLite cohérente précède toute modification effective au démarrage. La restauration et l’import Sillage préservent également les décisions utilisant les anciennes clés.

Les 1 152 comparaisons avec le code Sillage vérifient désormais le calendrier historique pour cette conversion. Les listes nationales diffèrent volontairement de Sillage par le retrait du férié québécois de juin; cet écart est documenté, sans modifier Sillage. Les règles calculées au-delà des années reçues restent une extrapolation, pas une vérification de tableaux annuels officiels.
