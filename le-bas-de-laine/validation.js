import { validDate } from "./dates.js";
export function validateState(s) {
  const integer = (n, label) => {
    if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12)
      throw Error("Entier monétaire invalide : " + label);
  };
  const date = (d, label) => {
    if (!validDate(d)) throw Error("Date invalide : " + label);
  };
  const sequences = new Set();
  for (const table of ["transactions", "transfers", "checkpoints"])
    for (const row of s[table]) {
      integer(row.seq, "ordre");
      if (row.seq < 1 || sequences.has(row.seq))
        throw Error("Ordre de saisie ambigu.");
      sequences.add(row.seq);
      date(row.date, table);
    }
  if (
    s.accounts.filter((a) => a.is_main).length > 1 ||
    s.accounts.some((a) => a.is_main && a.kind !== "bank")
  )
    throw Error("Compte principal invalide.");
  for (const a of s.accounts) {
    integer(a.opening_card_cents, "protection");
    if (a.opening_card_cents < 0) throw Error("Protection négative.");
  }
  for (const t of s.transactions) {
    integer(t.amount_cents, "transaction");
    integer(t.settled_cents, "paiement");
    if (
      !t.amount_cents ||
      t.settled_cents < 0 ||
      t.settled_cents > Math.abs(t.amount_cents) ||
      ![0, 1].includes(t.included)
    )
      throw Error("Transaction invalide.");
    if (t.period_on) date(t.period_on, "période");
  }
  for (const t of s.transfers) {
    integer(t.amount_cents, "virement");
    if (t.amount_cents <= 0 || ![0, 1].includes(t.included))
      throw Error("Virement invalide.");
  }
  for (const t of s.checkpoints) integer(t.amount_cents, "point de contrôle");
  for (const c of s.categories)
    if (c.limit_cents !== null) {
      integer(c.limit_cents, "limite");
      if (
        c.limit_cents < 0 ||
        !["weekly", "monthly"].includes(c.period) ||
        !Number.isInteger(c.renewal_day) ||
        c.renewal_day < (c.period === "weekly" ? 0 : 1) ||
        c.renewal_day > (c.period === "weekly" ? 6 : 31)
      )
        throw Error("Limite invalide.");
      if (c.starts_on) date(c.starts_on, "début");
    }
  for (const r of s.recurrences) {
    integer(r.amount_cents, "facture");
    date(r.start_on, "récurrence");
    if (
      r.amount_cents <= 0 ||
      ![
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "semiannual",
        "yearly",
        "last_business_day",
        "rrq",
      ].includes(r.frequency) ||
      !["none", "before", "after"].includes(r.day_adjust)
    )
      throw Error("Récurrence invalide.");
  }
  for (const o of s.occurrence_states) {
    date(o.original_on, "échéance");
    if (o.postponed_on) date(o.postponed_on, "report");
    if (o.amount_cents !== null) integer(o.amount_cents, "échéance");
  }
}
