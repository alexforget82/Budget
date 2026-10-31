import test from "node:test";
import assert from "node:assert/strict";
import { simulate, bankBalance, cardLots } from "../engine.js";
import { periodStart, nextPeriod, occurrences } from "../dates.js";
import { cents } from "../service.js";
const reference = "2026-10-22";
const base = () => ({
  accounts: [
    { id: 1, kind: "bank", name: "Conjoint", is_main: 1 },
    { id: 2, kind: "card", name: "CIBC" },
  ],
  categories: [
    {
      id: 1,
      name: "Épicerie",
      limit_cents: 23000,
      period: "weekly",
      renewal_day: 4,
      active: 1,
      starts_on: "2026-10-15",
    },
  ],
  transactions: [],
  transfers: [],
  checkpoints: [
    { id: 1, account_id: 1, seq: 1, amount_cents: 100000, date: reference },
  ],
  recurrences: [
    {
      id: 1,
      name: "Paie",
      kind: "income",
      account_id: 1,
      amount_cents: 100000,
      frequency: "biweekly",
      start_on: "2026-10-23",
      active: 1,
    },
  ],
  occurrence_states: [],
});
const buy = (n = -7169, account = 2, extra = {}) => ({
  id: 1,
  seq: 2,
  account_id: account,
  category_id: 1,
  amount_cents: n,
  date: reference,
  description: "Épicerie",
  ...extra,
});
const at = (sim, date) => sim.daily.find((d) => d.date === date);
test("1000 bank, 230 groceries, 71.69 card: available stays 770", () => {
  const s = base(),
    before = simulate(s, reference);
  assert.equal(before.available_cents, 77000);
  s.transactions.push(buy());
  const after = simulate(s, reference);
  assert.equal(after.available_cents, 77000);
  assert.equal(after.bank_cents, 100000);
  assert.equal(after.card_cents, 7169);
  assert.equal(after.categories[0].current.remaining_cents, 15831);
  assert.equal(
    after.breakdown.bank_cents -
      after.breakdown.cards_cents -
      after.breakdown.bills_cents -
      after.breakdown.limits_cents,
    after.available_cents,
  );
});
test("bank purchase moves cash and remaining limit once", () => {
  const s = base();
  s.transactions.push(buy(-7169, 1));
  const sim = simulate(s, reference);
  assert.equal(sim.available_cents, 77000);
  assert.equal(sim.bank_cents, 92831);
  assert.equal(sim.card_cents, 0);
});
test("all Thursdays before payday protect their full new period", () => {
  const s = base();
  s.recurrences[0].start_on = "2026-11-06";
  s.transactions.push(buy());
  const sim = simulate(s, reference);
  assert.equal(at(sim, "2026-10-22").safe_cents, 77000);
  assert.equal(at(sim, "2026-10-29").safe_cents, 54000);
  assert.equal(at(sim, "2026-11-05").safe_cents, 31000);
  assert.equal(sim.available_cents, 31000);
  assert.equal(sim.bank_cents, 100000);
});
test("early card purchase reduces next Thursday, retaining actual date", () => {
  const s = base();
  s.categories[0].starts_on = "2026-10-22";
  s.transactions.push(
    buy(-7169, 2, { date: "2026-10-21", period_on: "2026-10-22" }),
  );
  const sim = simulate(s, "2026-10-21");
  assert.equal(sim.daily[0].safe_cents, 92831);
  assert.equal(at(sim, "2026-10-22").safe_cents, 77000);
  assert.equal(sim.available_cents, 77000);
  assert.equal(s.transactions[0].date, "2026-10-21");
});
test("partial, full and excess payments release protection once", () => {
  for (const [payment, safe, held] of [
    [2000, 77000, 5169],
    [7169, 77000, 0],
    [10000, 74169, 0],
  ]) {
    const s = base();
    s.transactions.push(buy());
    s.transfers.push({
      id: 1,
      seq: 3,
      from_account_id: 1,
      to_account_id: 2,
      amount_cents: payment,
      date: reference,
    });
    const sim = simulate(s, reference);
    assert.equal(sim.bank_cents, 100000 - payment);
    assert.equal(sim.card_cents, held);
    assert.equal(sim.available_cents, safe);
  }
});
test("unbudgeted card purchase stays protected", () => {
  const s = base();
  s.transactions.push(buy(-10000, 2, { category_id: null }));
  assert.equal(simulate(s, reference).available_cents, 67000);
});
test("payments release only the intended card", () => {
  const s = base();
  s.accounts.push({ id: 3, kind: "card" });
  s.transactions.push(
    buy(-10000, 2, { category_id: null }),
    buy(-5000, 3, { id: 2, seq: 3, category_id: null }),
  );
  s.transfers.push({
    id: 1,
    seq: 4,
    from_account_id: 1,
    to_account_id: 2,
    amount_cents: 10000,
  });
  assert.equal(
    cardLots(s).reduce((n, l) => n + l.remaining_cents, 0),
    5000,
  );
  assert.equal(cardLots(s)[0].account_id, 3);
});
test("checkpoint includes everything entered before regardless of same-day date", () => {
  const s = base();
  s.transactions.push(buy(-10000, 1, { category_id: null }));
  assert.equal(bankBalance(s), 90000);
  s.checkpoints.push({
    id: 2,
    seq: 3,
    account_id: 1,
    amount_cents: 90000,
    date: reference,
  });
  assert.equal(bankBalance(s), 90000);
  s.transactions.push(buy(-2000, 1, { id: 2, seq: 4, category_id: null }));
  assert.equal(bankBalance(s), 88000);
});
test("historical bank import changes category usage without another debit", () => {
  const s = base();
  s.transactions.push(buy(-7169, 1, { included: 1 }));
  const sim = simulate(s, reference);
  assert.equal(sim.bank_cents, 100000);
  assert.equal(sim.available_cents, 84169);
});
test("checkpoint never clears unpaid card purchases", () => {
  const s = base();
  s.transactions.push(buy());
  s.checkpoints.push({
    id: 2,
    seq: 4,
    account_id: 1,
    amount_cents: 100000,
    date: reference,
  });
  assert.equal(simulate(s, reference).card_cents, 7169);
});
test("overdue bills persist, postponement changes the day, cancellation resolves", () => {
  const s = base();
  s.recurrences.push({
    id: 2,
    name: "Hydro",
    kind: "expense",
    account_id: 1,
    amount_cents: 10000,
    frequency: "monthly",
    one_time: 1,
    start_on: "2026-10-20",
    active: 1,
  });
  assert.equal(simulate(s, reference).available_cents, 67000);
  s.occurrence_states.push({
    rule_id: 2,
    original_on: "2026-10-20",
    status: "postponed",
    postponed_on: "2026-10-26",
  });
  assert.equal(simulate(s, reference).available_cents, 77000);
  s.occurrence_states[0].status = "cancelled";
  assert.equal(simulate(s, reference).available_cents, 77000);
});
test("paying a bill replaces its forecast, allowing actual amount adjustment", () => {
  const s = base();
  s.recurrences.push({
    id: 2,
    name: "Hydro",
    kind: "expense",
    account_id: 1,
    amount_cents: 10000,
    frequency: "monthly",
    one_time: 1,
    start_on: reference,
    active: 1,
  });
  assert.equal(simulate(s, reference).available_cents, 67000);
  s.transactions.push(buy(-9000, 1, { category_id: null }));
  s.occurrence_states.push({
    rule_id: 2,
    original_on: reference,
    status: "paid",
    transaction_id: 1,
  });
  assert.equal(simulate(s, reference).available_cents, 68000);
});
test("future card bill plus repayment never double charges", () => {
  const s = base();
  s.recurrences.push(
    {
      id: 2,
      name: "Apple",
      kind: "expense",
      account_id: 2,
      amount_cents: 5398,
      frequency: "monthly",
      one_time: 1,
      start_on: reference,
      active: 1,
    },
    {
      id: 3,
      name: "Paiement",
      kind: "transfer",
      account_id: 1,
      to_account_id: 2,
      amount_cents: 5398,
      frequency: "monthly",
      one_time: 1,
      start_on: reference,
      active: 1,
    },
  );
  const sim = simulate(s, reference);
  assert.equal(sim.available_cents, 71602);
  assert.equal(sim.daily[0].card_cents, 0);
  assert.equal(sim.daily[0].cash_cents, 94602);
});
test("income expected today is unavailable until receipt", () => {
  const s = base();
  s.recurrences[0].start_on = reference;
  const sim = simulate(s, reference);
  assert.equal(sim.daily[0].cash_cents, 100000);
  assert.equal(
    sim.upcoming.find((e) => e.kind === "income").awaiting_receipt,
    true,
  );
});
test("available before payday and minimum on 30 days are separate", () => {
  const s = base();
  s.recurrences[0].amount_cents = 10000;
  const sim = simulate(s, reference);
  assert.equal(sim.daily.length, 30);
  assert.equal(sim.available_cents, 77000);
  assert.ok(sim.minimum_cents < 77000);
  assert.throws(() => simulate(s, reference, 90));
});
test("weekly and monthly boundaries include leap year", () => {
  const c = { period: "monthly", renewal_day: 31 };
  assert.equal(periodStart(c, "2028-02-29"), "2028-02-29");
  assert.equal(nextPeriod(c, "2028-02-29"), "2028-03-31");
  assert.equal(
    periodStart({ period: "weekly", renewal_day: 4 }, "2026-10-21"),
    "2026-10-15",
  );
});
test("actual biweekly dates count 3 October paychecks and 2 November paychecks", () => {
  const r = {
    id: 1,
    name: "Paie",
    kind: "income",
    amount_cents: 116805,
    frequency: "biweekly",
    start_on: "2026-10-02",
  };
  assert.equal(occurrences(r, "2026-10-01", "2026-10-31").length, 3);
  assert.equal(occurrences(r, "2026-11-01", "2026-11-30").length, 2);
});
test("historical paid purchases and refunds never erase new card protections", () => {
  const s = base();
  s.card_baseline_seq = 5;
  s.transactions.push(
    buy(-10000, 2, { settled_cents: 10000 }),
    buy(5000, 2, { id: 2, seq: 3 }),
    buy(-4000, 2, { id: 3, seq: 6, category_id: null }),
  );
  s.transfers.push({
    id: 1,
    seq: 4,
    to_account_id: 2,
    from_account_id: 1,
    amount_cents: 99999,
    included: 1,
  });
  assert.equal(simulate(s, reference).card_cents, 4000);
});
test("fractional cents are rejected without rounding", () => {
  assert.equal(cents("1 168,05"), 116805);
  assert.equal(cents("0"), 0);
  assert.equal(cents("-71.69"), -7169);
  for (const n of ["1.005", "NaN", "1e6", "12,5,0", ""])
    assert.throws(() => cents(n));
});
test("pure simulation preserves inputs and reconciles every day", () => {
  const s = base();
  s.transactions.push(buy());
  const before = structuredClone(s),
    sim = simulate(s, reference);
  assert.deepEqual(s, before);
  for (const d of sim.daily)
    assert.equal(d.cash_cents - d.card_cents - d.limits_cents, d.safe_cents);
});
