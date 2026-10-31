import { simulate } from "./engine.js";
export function demo(reference = "2026-10-21") {
  const add = (n) =>
    new Date(Date.parse(reference + "T12:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const weekday = new Date(reference + "T12:00:00Z").getUTCDay();
  return {
    accounts: [
      {
        id: 1,
        name: "Conjoint",
        kind: "bank",
        is_main: 1,
        opening_card_cents: 0,
      },
      {
        id: 2,
        name: "Carte CIBC",
        kind: "card",
        is_main: 0,
        opening_card_cents: 0,
      },
    ],
    categories: [
      {
        id: 1,
        name: "Épicerie",
        limit_cents: 23000,
        period: "weekly",
        renewal_day: (weekday + 1) % 7,
        starts_on: add(-6),
        active: 1,
      },
      {
        id: 2,
        name: "Essence",
        limit_cents: 6000,
        period: "weekly",
        renewal_day: weekday,
        starts_on: reference,
        active: 1,
      },
      {
        id: 3,
        name: "Restaurant",
        limit_cents: 12500,
        period: "monthly",
        renewal_day: 1,
        starts_on: reference.slice(0, 8) + "01",
        active: 1,
      },
      { id: 4, name: "Factures", limit_cents: null, active: 1 },
    ],
    transactions: [
      {
        id: 1,
        seq: 1,
        account_id: 2,
        category_id: 1,
        description: "Épicerie",
        amount_cents: -7169,
        date: reference,
        included: 0,
        settled_cents: 0,
      },
      {
        id: 2,
        seq: 2,
        account_id: 1,
        category_id: 2,
        description: "Essence",
        amount_cents: -2500,
        date: reference,
        included: 1,
        settled_cents: 0,
      },
      {
        id: 3,
        seq: 3,
        account_id: 1,
        category_id: 3,
        description: "Restaurant",
        amount_cents: -3800,
        date: reference,
        included: 1,
        settled_cents: 0,
      },
    ],
    transfers: [],
    checkpoints: [
      {
        id: 1,
        seq: 4,
        account_id: 1,
        amount_cents: 200000,
        date: reference,
        difference_cents: 0,
      },
    ],
    recurrences: [
      {
        id: 1,
        name: "Cellulaire",
        kind: "expense",
        account_id: 1,
        amount_cents: 6599,
        frequency: "monthly",
        start_on: add(2),
        active: 1,
      },
      {
        id: 2,
        name: "Assurance auto",
        kind: "expense",
        account_id: 1,
        amount_cents: 11200,
        frequency: "monthly",
        start_on: add(6),
        active: 1,
      },
      {
        id: 3,
        name: "Paie Alex",
        kind: "income",
        account_id: 1,
        amount_cents: 180000,
        frequency: "biweekly",
        start_on: add(9),
        active: 1,
      },
    ],
    occurrence_states: [],
    card_baseline_seq: 0,
  };
}
export const demoSnapshot = (reference) => ({
  simulation: simulate(demo(reference), reference || "2026-10-21"),
});
