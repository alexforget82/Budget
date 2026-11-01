import test from "node:test";
import assert from "node:assert/strict";
import { monthlyBudget } from "../budget.js";
const base = () => ({
  accounts: [],
  categories: [],
  recurrences: [],
  transactions: [],
  transfers: [],
  occurrence_states: [],
});
const rule = (
  id,
  kind,
  amount,
  start,
  frequency = "monthly",
  category_id = null,
) => ({
  id,
  name: kind === "income" ? "Salaire Alex" : "Facture",
  kind,
  amount_cents: amount,
  start_on: start,
  frequency,
  category_id,
  day_adjust: "none",
  active: 1,
});
test("budget counts real two- and three-paycheck months, not an annualized average", () => {
  const s = base();
  s.recurrences = [rule(1, "income", 116805, "2027-01-01", "biweekly")];
  const before = JSON.stringify(s),
    jan = monthlyBudget(s, "2027-01", "2027-01-01"),
    feb = monthlyBudget(s, "2027-02", "2027-01-01");
  assert.equal(jan.income.planned_cents, 350415);
  assert.equal(jan.income.rows[0].occurrence_count, 3);
  assert.equal(feb.income.planned_cents, 233610);
  assert.equal(feb.income.rows[0].occurrence_count, 2);
  assert.equal(JSON.stringify(s), before);
});
test("four/five allocations and weekly bills follow exact dates and category start", () => {
  const s = base();
  s.categories = [
    {
      id: 1,
      name: "Épicerie",
      limit_cents: 23000,
      period: "weekly",
      renewal_day: 4,
      starts_on: "2026-10-01",
      active: 1,
    },
  ];
  s.recurrences = [rule(1, "expense", 17553, "2026-11-02", "weekly")];
  const oct = monthlyBudget(s, "2026-10", "2026-10-01"),
    nov = monthlyBudget(s, "2026-11", "2026-10-01");
  assert.equal(oct.expense.planned_cents, 115000);
  assert.equal(oct.expense.rows[0].allocation_count, 5);
  assert.equal(nov.expense.planned_cents, 92000 + 87765);
  assert.equal(
    nov.expense.rows.find((r) => r.name === "Épicerie").allocation_count,
    4,
  );
  assert.equal(
    nov.expense.rows.find((r) => r.name === "Facture").occurrence_count,
    5,
  );
  s.categories[0].starts_on = "2026-10-29";
  assert.equal(
    monthlyBudget(s, "2026-10", "2026-10-01").expense.planned_cents,
    23000,
  );
});
test("paid occurrences stay in planned; unique amounts and date moves cross months without duplication", () => {
  const s = base();
  s.recurrences = [{ ...rule(1, "expense", 2000, "2026-10-31"), one_time: 1 }];
  s.occurrence_states = [
    {
      rule_id: 1,
      original_on: "2026-10-31",
      status: "paid",
      amount_cents: 3000,
      postponed_on: "2026-11-02",
      transaction_id: 1,
    },
  ];
  s.transactions = [
    { id: 1, date: "2026-11-03", amount_cents: -2500, category_id: null },
  ];
  const oct = monthlyBudget(s, "2026-10", "2026-11-04"),
    nov = monthlyBudget(s, "2026-11", "2026-11-04");
  assert.equal(oct.expense.planned_cents, 0);
  assert.equal(nov.expense.planned_cents, 3000);
  assert.equal(nov.expense.actual_cents, 2500);
  assert.equal(nov.expense.rows.length, 1);
  assert.equal(nov.expense.rows[0].variance_cents, 500);
  assert.equal(nov.expense.rows[0].name, "Facture");
  s.recurrences[0].active = 0;
  assert.equal(
    monthlyBudget(s, "2026-11", "2026-11-04").expense.planned_cents,
    3000,
  );
});
test("cancelled occurrences are excluded and next-month nominal dates may land in this month", () => {
  const s = base();
  s.recurrences = [
    {
      ...rule(1, "income", 100000, "2027-01-01", "biweekly"),
      day_adjust: "before",
    },
  ];
  const dec = monthlyBudget(s, "2026-12", "2026-12-01");
  assert.equal(dec.income.planned_cents, 100000);
  s.occurrence_states = [
    { rule_id: 1, original_on: "2026-12-31", status: "cancelled" },
  ];
  assert.equal(
    monthlyBudget(s, "2026-12", "2026-12-01").income.planned_cents,
    0,
  );
});
test("card purchases/refunds are counted once; transfers are separate from income and expense", () => {
  const s = base();
  s.categories = [
    {
      id: 1,
      name: "Épicerie",
      limit_cents: 23000,
      period: "weekly",
      renewal_day: 4,
      starts_on: "2027-04-01",
      active: 1,
    },
  ];
  s.transactions = [
    { id: 1, date: "2027-04-02", category_id: 1, amount_cents: -5000 },
    { id: 2, date: "2027-04-03", category_id: 1, amount_cents: 1000 },
  ];
  s.transfers = [{ date: "2027-04-04", amount_cents: 5000 }];
  s.recurrences = [rule(1, "transfer", 10000, "2027-04-15")];
  const result = monthlyBudget(s, "2027-04", "2027-04-04");
  assert.equal(result.expense.actual_cents, 4000);
  assert.equal(result.income.actual_cents, 0);
  assert.equal(result.transfers.actual_cents, 5000);
  assert.equal(result.transfers.planned_cents, 10000);
  assert.equal(result.net_actual_cents, -4000);
});
test("observed rollover is separate, never added to the monthly allocations, and not invented for a future month", () => {
  const s = base();
  s.weekly_rollover_from = "2027-04-01";
  s.categories = [
    {
      id: 1,
      name: "Épicerie",
      limit_cents: 23000,
      period: "weekly",
      renewal_day: 4,
      starts_on: "2027-04-01",
      active: 1,
    },
  ];
  s.transactions = [
    {
      id: 1,
      date: "2027-04-01",
      category_id: 1,
      amount_cents: -18000,
      period_on: "2027-04-01",
    },
  ];
  const before = JSON.stringify(s),
    result = monthlyBudget(s, "2027-04", "2027-04-08");
  assert.equal(result.reports.total_cents, 5000);
  assert.equal(result.reports.observed_on, "2027-04-08");
  assert.equal(result.expense.planned_cents, 115000);
  assert.equal(result.expense.actual_cents, 18000);
  assert.equal(
    monthlyBudget(s, "2027-05", "2027-04-08").reports.observed_on,
    null,
  );
  assert.equal(JSON.stringify(s), before);
});
test("quarterly, semiannual, yearly and estimated RRQ rules retain their own schedules", () => {
  const s = base();
  s.recurrences = [
    rule(1, "expense", 10000, "2026-01-31", "quarterly"),
    rule(2, "expense", 20000, "2026-01-31", "semiannual"),
    rule(3, "expense", 30000, "2024-02-29", "yearly"),
  ];
  assert.equal(
    monthlyBudget(s, "2026-04", "2026-01-01").expense.planned_cents,
    10000,
  );
  assert.equal(
    monthlyBudget(s, "2026-07", "2026-01-01").expense.planned_cents,
    30000,
  );
  assert.equal(
    monthlyBudget(s, "2027-02", "2026-01-01").expense.planned_cents,
    30000,
  );
  s.recurrences = [rule(1, "income", 100000, "2026-11-01", "rrq")];
  assert.equal(
    monthlyBudget(s, "2026-12", "2026-11-01").income.planned_cents,
    100000,
  );
  assert.equal(monthlyBudget(s, "2027-01", "2026-11-01").warnings.length, 1);
});
test("invalid months reject rather than display a fictitious zero budget", () => {
  for (const month of [
    "",
    "2027-13",
    "2027-00",
    "9999-01",
    "2027-1",
    "not-a-month",
  ])
    assert.throws(() => monthlyBudget(base(), month, "2027-01-01"));
});
