import {
  addDays,
  periodStart,
  nextPeriod,
  occurrences,
  validDate,
} from "./dates.js";
// All amounts are integer cents. No database writes and no wall-clock dependency.
export function cardLots(state) {
  const cards = new Set(
      state.accounts.filter((a) => a.kind === "card").map((a) => a.id),
    ),
    lots = [];
  for (const a of state.accounts.filter((a) => cards.has(a.id)))
    if (a.opening_card_cents > 0)
      lots.push({ account_id: a.id, remaining_cents: a.opening_card_cents });
  const pay = (id, amount) => {
    for (const lot of lots) {
      if (lot.account_id !== id || amount <= 0) continue;
      const part = Math.min(amount, lot.remaining_cents);
      lot.remaining_cents -= part;
      amount -= part;
    }
  };
  const events = [
    ...state.transactions.map((t) => ({ ...t, event: "transaction" })),
    ...state.transfers.map((t) => ({ ...t, event: "transfer" })),
  ]
    .filter(
      (t) =>
        t.seq > (state.card_baseline_seq || 0) ||
        (t.event === "transaction" && t.amount_cents < 0),
    )
    .sort((a, b) => a.seq - b.seq);
  for (const t of events) {
    if (t.event === "transfer") {
      if (cards.has(t.to_account_id)) pay(t.to_account_id, t.amount_cents);
    } else if (cards.has(t.account_id)) {
      if (t.amount_cents > 0 && t.settled_cents === t.amount_cents) continue;
      if (t.amount_cents < 0)
        lots.push({
          account_id: t.account_id,
          transaction_id: t.id,
          remaining_cents: Math.max(
            0,
            -t.amount_cents - (t.settled_cents || 0),
          ),
        });
      else pay(t.account_id, t.amount_cents);
    }
  }
  return lots.filter((l) => l.remaining_cents > 0);
}
export function bankBalance(state) {
  const bank = state.accounts.find((a) => a.kind === "bank" && a.is_main);
  if (!bank) return 0;
  const cp = state.checkpoints
    .filter((c) => c.account_id === bank.id)
    .sort((a, b) => b.seq - a.seq)[0];
  let balance = cp?.amount_cents || 0,
    seq = cp?.seq || 0;
  for (const t of state.transactions)
    if (t.account_id === bank.id && t.seq > seq && !t.included)
      balance += t.amount_cents;
  for (const t of state.transfers)
    if (t.seq > seq && !t.included) {
      if (t.from_account_id === bank.id) balance -= t.amount_cents;
      if (t.to_account_id === bank.id) balance += t.amount_cents;
    }
  return balance;
}
export function categoryPeriods(state, reference, end) {
  const limitedIds = new Set(
    state.categories
      .filter((c) => c.limit_cents !== null && c.active)
      .map((c) => c.id),
  );
  const fallback = state.categories.find(
    (c) => c.id === state.fallback_category_id && limitedIds.has(c.id),
  );
  const fixedTransactions = new Set(
    state.occurrence_states
      .filter((o) => o.status === "paid" && o.transaction_id)
      .map((o) => o.transaction_id),
  );
  const fallbackApplies = (t) =>
    !limitedIds.has(t.category_id) &&
    !fixedTransactions.has(t.id) &&
    !["factures", "revenus"].includes(
      state.categories
        .find((c) => c.id === t.category_id)
        ?.name.trim()
        .toLocaleLowerCase("fr-CA"),
    ) &&
    (t.amount_cents < 0 || !!t.category_id);
  return state.categories
    .filter((c) => c.limit_cents !== null && c.active)
    .map((c) => {
      let first = periodStart(c, reference);
      if (c.starts_on && first < c.starts_on)
        first = periodStart(c, c.starts_on);
      const periods = [];
      for (let start = first; start <= end; start = nextPeriod(c, start)) {
        const spent = state.transactions
          .filter(
            (t) =>
              (t.category_id === c.id ||
                (c.id === fallback?.id && fallbackApplies(t))) &&
              !(c.id === fallback?.id && fixedTransactions.has(t.id)) &&
              ((t.category_id === c.id ? t.period_on : null) ||
                periodStart(c, t.date)) === start,
          )
          .reduce((s, t) => s - t.amount_cents, 0);
        periods.push({
          date: start,
          end: addDays(nextPeriod(c, start), -1),
          limit_cents: c.limit_cents,
          spent_cents: spent,
          remaining_cents: Math.max(0, c.limit_cents - Math.max(0, spent)),
        });
      }
      return { ...c, periods };
    });
}
export function simulate(state, reference, horizon = 90) {
  if (
    !validDate(reference) ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 90
  )
    throw Error("Date ou horizon invalide.");
  const end = addDays(reference, Math.max(horizon, 366)),
    bank = state.accounts.find((a) => a.kind === "bank" && a.is_main),
    cards = new Set(
      state.accounts.filter((a) => a.kind === "card").map((a) => a.id),
    );
  const actions = new Map(
    state.occurrence_states.map((s) => [s.rule_id + ":" + s.original_on, s]),
  );
  const rules = state.recurrences.filter((r) => r.active),
    events = [];
  for (const r of rules) {
    // Past unresolved bills remain obligations; past unreceived income never finances spending.
    const start = r.start_on < reference ? r.start_on : reference;
    for (const o of occurrences(r, start, end)) {
      const action = actions.get(o.key);
      if (action?.status === "paid" || action?.status === "cancelled") continue;
      o.date = action?.postponed_on || o.date;
      o.amount_cents = action?.amount_cents ?? o.amount_cents;
      if (o.kind === "income" && o.date < reference) continue;
      if (o.kind === "income" && o.date === reference)
        o.awaiting_receipt = true;
      if (o.date < reference) o.overdue = true;
      events.push(o);
    }
  }
  const nextPay =
    events
      .filter(
        (e) =>
          e.kind === "income" &&
          e.account_id === bank?.id &&
          e.date >= reference,
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0]?.date || null;
  // Money needed before a same-day paycheck is kept protected through the previous day.
  const last = addDays(reference, horizon - 1),
    spendingEnd = addDays(reference, Math.min(horizon, 30) - 1),
    until =
      nextPay && nextPay <= addDays(spendingEnd, 1)
        ? nextPay <= reference
          ? reference
          : addDays(nextPay, -1)
        : spendingEnd;
  const categories = categoryPeriods(state, reference, last),
    lots = cardLots(state),
    cardHeld = new Map();
  for (const lot of lots)
    cardHeld.set(
      lot.account_id,
      (cardHeld.get(lot.account_id) || 0) + lot.remaining_cents,
    );
  const initialCash = bankBalance(state),
    initialCards = [...cardHeld.values()].reduce((s, n) => s + n, 0);
  let cash = initialCash,
    paidBills = 0,
    days = [];
  const pay = (id, n) =>
    cardHeld.set(id, Math.max(0, (cardHeld.get(id) || 0) - n));
  for (
    let date = reference;
    date <= last || date <= until;
    date = addDays(date, 1)
  ) {
    const dayEvents = events
      .filter((e) => (e.date < reference ? reference : e.date) === date)
      .sort(
        (a, b) =>
          (a.kind === "income" ? 0 : a.kind === "expense" ? 1 : 2) -
          (b.kind === "income" ? 0 : b.kind === "expense" ? 1 : 2),
      );
    for (const e of dayEvents) {
      if (e.kind === "income") {
        if (e.awaiting_receipt) continue;
        if (e.account_id === bank?.id) cash += e.amount_cents;
        else if (cards.has(e.account_id)) pay(e.account_id, e.amount_cents);
      } else if (e.kind === "expense") {
        if (e.account_id === bank?.id) {
          cash -= e.amount_cents;
          paidBills += e.amount_cents;
        } else if (cards.has(e.account_id)) {
          cardHeld.set(
            e.account_id,
            (cardHeld.get(e.account_id) || 0) + e.amount_cents,
          );
          paidBills += e.amount_cents;
        }
      } else {
        if (e.account_id === bank?.id) cash -= e.amount_cents;
        if (e.to_account_id === bank?.id) cash += e.amount_cents;
        if (cards.has(e.to_account_id)) pay(e.to_account_id, e.amount_cents);
      }
    }
    // Limits are protections, not fictional bank debits. New periods accumulate in the forecast.
    const limits = categories.reduce(
      (sum, c) =>
        sum +
        c.periods
          .filter((p) => p.date <= date)
          .reduce((n, p) => n + p.remaining_cents, 0),
      0,
    );
    const cardTotal = [...cardHeld.values()].reduce((s, n) => s + n, 0);
    if (
      ![cash, cardTotal, limits, cash - cardTotal - limits].every(
        Number.isSafeInteger,
      )
    )
      throw Error("Total monétaire trop élevé.");
    days.push({
      date,
      cash_cents: cash,
      card_cents: cardTotal,
      limits_cents: limits,
      safe_cents: cash - cardTotal - limits,
      events: dayEvents,
    });
  }
  const window = days.filter((d) => d.date <= until),
    low = window.reduce(
      (a, b) => (b.safe_cents < a.safe_cents ? b : a),
      window[0],
    );
  const daily = days.slice(0, horizon),
    min = daily.reduce(
      (a, b) => (b.safe_cents < a.safe_cents ? b : a),
      daily[0],
    );
  // The last line includes all dated obligations and other cash movements up to the limiting day.
  const projectedObligations =
    initialCash - initialCards - low.safe_cents - low.limits_cents;
  return {
    reference,
    next_pay: nextPay,
    until,
    bank_cents: initialCash,
    card_cents: initialCards,
    available_cents: low.safe_cents,
    minimum_cents: min.safe_cents,
    minimum_on: min.date,
    minimum_horizon_days: horizon,
    risk: {
      below_available: min.safe_cents < low.safe_cents,
      date: min.date,
      amount_cents: min.safe_cents,
      bills: min.events.filter(
        (e) => e.kind === "expense" || e.kind === "transfer",
      ),
      renewals: categories
        .filter((c) =>
          c.periods.some((p) => p.date === min.date && p.date > reference),
        )
        .map((c) => ({ id: c.id, name: c.name })),
    },
    limits_details: {
      through: low.date,
      until,
      total_cents: low.limits_cents,
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          periods: c.periods
            .filter((p) => p.date <= low.date)
            .map((p) => ({
              ...p,
              kind: p.date <= reference ? "current" : "renewal",
            })),
        }))
        .filter((c) => c.periods.length),
    },
    breakdown: {
      bank_cents: initialCash,
      cards_cents: initialCards,
      bills_cents: projectedObligations,
      limits_cents: low.limits_cents,
    },
    daily,
    categories: categories.map((c) => ({
      ...c,
      current: c.periods[0],
      next: c.periods[0] ? nextPeriod(c, c.periods[0].date) : c.starts_on,
    })),
    upcoming: events
      .filter((e) => e.date <= addDays(reference, 13))
      .sort((a, b) => a.date.localeCompare(b.date)),
    warnings: [
      ...(rules.some((r) => r.frequency === "rrq")
        ? [
            "Les dates RRQ sont estimées : confirmez le calendrier officiel de Retraite Québec.",
          ]
        : []),
      ...(!nextPay
        ? ["Aucune prochaine paie connue : le disponible couvre 30 jours."]
        : nextPay > addDays(reference, 30)
          ? [
              "La prochaine paie dépasse 30 jours : le disponible avant la paie est plafonné à 30 jours.",
            ]
          : []),
      ...(events.some((e) => e.overdue)
        ? ["Des factures en retard restent à couvrir."]
        : []),
    ],
  };
}
