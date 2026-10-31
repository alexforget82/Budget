import { simulate } from "./engine.js";
import { cents } from "./service.js";
import { validDate, addDays } from "./dates.js";
export function purchaseQuote(
  data,
  reference,
  input,
  { provisional = false } = {},
) {
  const amount = cents(input.amount),
    date = input.date || reference;
  if (
    amount <= 0 ||
    !validDate(date) ||
    date < reference ||
    date > addDays(reference, 60)
  )
    throw Error(
      "Montant positif et date au plus 60 jours après aujourd’hui requis, pour vérifier 30 jours complets.",
    );
  const account_id = Number(
      input.account_id ?? data.accounts.find((a) => a.is_main)?.id,
    ),
    account = data.accounts.find((a) => a.id === account_id);
  if (!account || !(account.is_main || account.kind === "card"))
    throw Error("Choisissez le compte principal ou une carte.");
  const category_id = input.category_id ? Number(input.category_id) : null;
  if (category_id && !data.categories.some((c) => c.id === category_id))
    throw Error("Catégorie introuvable.");
  const baseline = simulate(data, reference),
    result = simulate(data, reference, 90, {
      amount_cents: amount,
      date,
      account_id,
      category_id,
      period_on: null,
    }),
    window = result.daily.filter(
      (d) => d.date >= date && d.date <= addDays(date, 29),
    ),
    min = window.reduce((a, b) => (a.safe_cents < b.safe_cents ? a : b));
  return {
    allowed: !provisional && min.safe_cents >= 0,
    provisional,
    minimum_cents: min.safe_cents,
    minimum_on: min.date,
    maximum_cents: Math.max(...window.map((d) => d.safe_cents)),
    days: window.length,
    available_cents: result.available_cents,
    baseline_available_cents: baseline.available_cents,
  };
}
