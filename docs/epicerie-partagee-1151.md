# Épicerie dans la vue simplifiée

Depuis la v11.5.2, la carte reste visible avant le premier renouvellement : elle affiche le montant prévu et « Débute le… ». Sans calendrier, elle présente la réserve actuelle et une indication de configuration. Les modalités de la v11.5.1 ci-dessous décrivent le suivi lorsqu’une période a commencé.

Après mise à jour du Mac, actualiser le lien habituel de la vue simplifiée sur l’iPhone. Aucun nouveau lien n’est nécessaire.

La carte apparaît pour l’unique enveloppe active nommée Épicerie ou Epicerie, lorsque sa première période a commencé. Son montant et sa fréquence proviennent de l’enveloppe existante : rien n’est fixé à 230 $ ou 203 $. Avec 230 $ de budget et 50 $ d’achats associés, le restant est 180 $. Avec 203 $, il est 153 $.

Le prochain renouvellement indique le jour et la date; une enveloppe hebdomadaire ancrée au jeudi conserve ce calendrier. Le suivi reste celui de la période de l’enveloppe lorsque la prévision change entre 30, 60 et 90 jours. Les achats associés à une autre échéance sont exclus. Le report utilise la réserve conservée après application du renouvellement courant, sans inclure les avances restantes destinées à une période future.

Les achats doivent être enregistrés et associés à cette enveloppe, sur compte bancaire ou carte. La vue ne synchronise pas les achats bancaires automatiquement et ne permet pas d’en enregistrer. Les remboursements ne sont pas ajoutés aux achats de la période : le suivi reprend la définition des dépenses de l’interface propriétaire.

Le lien partage seulement les montants globaux déjà présents et les dates, libellés et montants des achats d’épicerie associés. Aucun autre achat, compte, catégorie ou enveloppe n’est transmis. Les libellés sont affichés comme texte. Si plusieurs enveloppes actives portent ce nom, aucune n’est choisie arbitrairement. La révocation du lien masque et efface le suivi à la prochaine actualisation.

Validation : 97 tests Node et 192 tests API réussis, dont quatre cas spécifiques. Six parcours navigateur ciblés réussis, comprenant la nouvelle carte, les vues simplifiées existantes et la comparaison financière avec la référence. Essais sur données temporaires et Chromium Linux; Safari iOS reste à confirmer sur appareil. Calcul du Safe-to-Spend et schéma SQLite conservés.
