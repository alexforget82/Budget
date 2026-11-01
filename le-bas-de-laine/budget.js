import { occurrenceInfo } from "./calendar.js";
import { periodStart, nextPeriod, validDate, addDays } from "./dates.js";
import { categoryPeriods } from "./engine.js";
export function monthlyBudget(state, month, reference) {
  if (
    !/^\d{4}-\d{2}$/.test(month || "") ||
    !validDate(month + "-01") ||
    +month.slice(0, 4) < 1900 ||
    +month.slice(0, 4) > 2200
  )
    throw Error("Choisissez un mois entre 1900 et 2200.");
  if (!validDate(reference)) throw Error("Date de référence invalide.");
  const start = month + "-01",
    end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0, 12))
      .toISOString()
      .slice(0, 10),
    rows = new Map(),
    rules = new Map(state.recurrences.map((r) => [r.id, r])),
    categories = new Map(state.categories.map((c) => [c.id, c]));
  const safe = (n) => {
    if (!Number.isSafeInteger(n)) throw Error("Total du budget trop élevé.");
    return n;
  };
  const get = (kind, key, name) => {
    const id = kind + ":" + key;
    if (!rows.has(id))
      rows.set(id, {
        id,
        kind,
        name,
        planned_cents: 0,
        actual_cents: 0,
        allocation_count: 0,
        occurrence_count: 0,
        transaction_count: 0,
      });
    return rows.get(id);
  };
  const group = (kind, category_id, rule) =>
    category_id && categories.has(category_id)
      ? get(kind, "category:" + category_id, categories.get(category_id).name)
      : rule
        ? get(kind, "rule:" + rule.id, rule.name)
        : get(
            kind,
            "uncategorized",
            kind === "income" ? "Autres revenus" : "Sans catégorie",
          );
  const add = (row, field, amount) => {
    row[field] = safe(row[field] + amount);
  };
  for (const c of state.categories.filter(
    (c) => c.active && c.limit_cents !== null,
  )) {
    let date = periodStart(c, start);
    if (date < start) date = nextPeriod(c, date);
    if (c.starts_on) {
      const first = periodStart(c, c.starts_on);
      if (date < first) date = first;
    }
    for (; date <= end; date = nextPeriod(c, date)) {
      const row = group("expense", c.id);
      add(row, "planned_cents", c.limit_cents);
      row.allocation_count++;
    }
  }
  const actionsByRule = new Map();
  for (const a of state.occurrence_states) {
    if (!actionsByRule.has(a.rule_id)) actionsByRule.set(a.rule_id, new Map());
    actionsByRule.get(a.rule_id).set(a.original_on, a);
  }
  const warnings = [],
    transfers = { planned_cents: 0, actual_cents: 0 };
  for (const r of state.recurrences) {
    if (
      r.kind === "expense" &&
      categories.get(r.category_id)?.active &&
      categories.get(r.category_id)?.limit_cents != null
    ) {
      warnings.push(
        r.name +
          " : déjà couvert par une limite, non ajouté une seconde fois au prévu.",
      );
      continue;
    }
    const actions = actionsByRule.get(r.id) || new Map();
    let scanEnd = end;
    for (const a of actions.values())
      if (a.original_on > scanEnd) scanEnd = a.original_on;
    for (let i = 0; i < 30000; i++) {
      const info = occurrenceInfo(
        r.start_on,
        r.frequency,
        i,
        r.day_adjust || "none",
      );
      if (info.date > scanEnd) break;
      const action = actions.get(info.date),
        date = action?.postponed_on || info.date;
      if (
        action?.status !== "cancelled" &&
        (r.active || action?.status === "paid") &&
        date >= start &&
        date <= end
      ) {
        const amount = action?.amount_cents ?? r.amount_cents;
        if (r.kind === "transfer")
          transfers.planned_cents = safe(transfers.planned_cents + amount);
        else {
          const row = group(r.kind, r.category_id, r);
          add(row, "planned_cents", amount);
          row.occurrence_count++;
        }
        if (info.estimated) {
          const message = r.name + " : date estimée à confirmer.";
          if (!warnings.includes(message)) warnings.push(message);
        }
      }
      if (r.one_time) break;
      if (i === 29999)
        throw Error("Historique trop long pour calculer ce mois.");
    }
  }
  const links = new Map(
    state.occurrence_states
      .filter((a) => a.transaction_id)
      .map((a) => [a.transaction_id, rules.get(a.rule_id)]),
  );
  for (const t of state.transactions) {
    if (t.date < start || t.date > end) continue;
    const linked = links.get(t.id),
      limited = categories.get(t.category_id)?.limit_cents != null;
    const kind =
      linked?.kind === "expense" || (t.amount_cents > 0 && limited)
        ? "expense"
        : t.amount_cents > 0
          ? "income"
          : "expense";
    const row = group(
      kind,
      t.category_id || linked?.category_id,
      linked?.kind === kind ? linked : null,
    );
    add(
      row,
      "actual_cents",
      kind === "income" ? t.amount_cents : -t.amount_cents,
    );
    row.transaction_count++;
  }
  for (const t of state.transfers || [])
    if (t.date >= start && t.date <= end)
      transfers.actual_cents = safe(transfers.actual_cents + t.amount_cents);
  const all = [...rows.values()].map((row) => ({
    ...row,
    variance_cents: safe(
      row.kind === "income"
        ? row.actual_cents - row.planned_cents
        : row.planned_cents - row.actual_cents,
    ),
  }));
  const groups = {};
  for (const kind of ["income", "expense"]) {
    const list = all
      .filter((r) => r.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name, "fr-CA"));
    groups[kind] = {
      rows: list,
      planned_cents: safe(list.reduce((n, r) => n + r.planned_cents, 0)),
      actual_cents: safe(list.reduce((n, r) => n + r.actual_cents, 0)),
    };
    groups[kind].variance_cents = safe(
      kind === "income"
        ? groups[kind].actual_cents - groups[kind].planned_cents
        : groups[kind].planned_cents - groups[kind].actual_cents,
    );
  }
  const observed_on =
    month > reference.slice(0, 7)
      ? null
      : month === reference.slice(0, 7)
        ? reference
        : end;
  const reports = [];
  if (observed_on) {
    const observed = {
      ...state,
      transactions: state.transactions.filter((t) => t.date <= observed_on),
    };
    for (const c of categoryPeriods(
      observed,
      observed_on,
      addDays(observed_on, 89),
    )) {
      const p = c.periods[0];
      if (!p || p.date > observed_on) continue;
      const amount = Math.min(
        p.remaining_cents,
        Math.max(
          0,
          (p.carry_cents || 0) -
            Math.max(0, p.spent_cents) -
            (p.advanced_cents || 0),
        ),
      );
      if (amount > 0)
        reports.push({ id: c.id, name: c.name, amount_cents: amount });
    }
  }
  return {
    month,
    start,
    end,
    reference,
    ...groups,
    net_planned_cents: safe(
      groups.income.planned_cents - groups.expense.planned_cents,
    ),
    net_actual_cents: safe(
      groups.income.actual_cents - groups.expense.actual_cents,
    ),
    reports: {
      observed_on,
      items: reports,
      total_cents: safe(reports.reduce((n, r) => n + r.amount_cents, 0)),
    },
    transfers,
    warnings,
  };
}
