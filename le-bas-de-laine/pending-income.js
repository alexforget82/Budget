import { occurrences, addDays } from "./dates.js";
// Explanation only: the financial engine remains unchanged.
export function pendingIncome(state, reference) {
  const main = state.accounts.find((a) => a.is_main)?.id,
    actions = new Map(
      state.occurrence_states.map((a) => [a.rule_id + ":" + a.original_on, a]),
    ),
    from = addDays(reference, -29),
    result = [];
  for (const rule of state.recurrences.filter(
    (r) => r.active && r.kind === "income" && r.account_id === main,
  )) {
    let scan = reference;
    for (const a of state.occurrence_states.filter(
      (a) => a.rule_id === rule.id,
    ))
      if (a.original_on > scan && a.postponed_on && a.postponed_on <= reference)
        scan = a.original_on;
    for (const o of occurrences(rule, "0001-01-01", scan)) {
      const a = actions.get(o.key);
      if (a?.status === "paid" || a?.status === "cancelled") continue;
      const date = a?.postponed_on || o.date;
      if (date < from || date > reference) continue;
      result.push({
        ...o,
        date,
        amount_cents: a?.amount_cents ?? o.amount_cents,
        awaiting_receipt: true,
      });
    }
  }
  return result.sort(
    (a, b) => b.date.localeCompare(a.date) || a.rule_id - b.rule_id,
  );
}
