import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { simulate } from "../engine.js";
import { addDays, today } from "../dates.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { purchaseQuote } from "../purchase.js";
function base(reference = "2027-04-08", start = "2027-04-01") {
  return {
    accounts: [
      { id: 1, kind: "bank", name: "Conjoint", is_main: 1 },
      { id: 2, kind: "card", name: "Carte" },
    ],
    categories: [
      {
        id: 1,
        name: "Épicerie",
        limit_cents: 23000,
        period: "weekly",
        renewal_day: 4,
        active: 1,
        starts_on: start,
      },
    ],
    transactions: [],
    transfers: [],
    checkpoints: [{ account_id: 1, seq: 1, amount_cents: 100000, date: start }],
    occurrence_states: [],
    recurrences: [
      {
        id: 1,
        name: "Paie",
        kind: "income",
        amount_cents: 500000,
        account_id: 1,
        start_on: addDays(reference, 1),
        frequency: "yearly",
        day_adjust: "none",
        one_time: 1,
        active: 1,
      },
    ],
    weekly_rollover_from: start,
  };
}
const spend = (s, date, amount, account = 1, period = date) =>
  s.transactions.push({
    id: s.transactions.length + 1,
    seq: s.transactions.length + 2,
    date,
    amount_cents: -amount,
    account_id: account,
    category_id: 1,
    period_on: period,
    included: 0,
    settled_cents: 0,
  });
test("230 weekly less 180 leaves a 50 carry and 280 next week, protected only once", () => {
  const s = base();
  spend(s, "2027-04-01", 18000);
  const result = simulate(s, "2027-04-08"),
    c = result.categories[0].current;
  assert.equal(c.carry_cents, 5000);
  assert.equal(c.budget_cents, 28000);
  assert.equal(c.remaining_cents, 28000);
  assert.equal(
    result.daily.find((d) => d.date === "2027-05-06").limits_cents,
    120000,
  );
  assert.equal(result.bank_cents, 82000);
  assert.equal(result.available_cents, 54000);
  assert.equal(
    result.daily.find((d) => d.date === "2027-04-15").limits_cents,
    51000,
  );
  assert.equal(
    result.daily.find((d) => d.date === "2027-04-22").limits_cents,
    74000,
  );
  assert.equal(
    result.limits_details.total_cents,
    result.limits_details.categories
      .flatMap((c) => c.periods)
      .reduce((n, p) => n + p.remaining_cents, 0),
  );
});
test("month boundary clears carry only at the first renewal, leaving the full allocation", () => {
  const s = base("2027-05-01");
  spend(s, "2027-04-01", 18000);
  const before = simulate(s, "2027-05-01").categories[0].current;
  assert.equal(before.date, "2027-04-29");
  assert.equal(before.budget_cents, 97000);
  assert.equal(before.carry_cents, 74000);
  const after = simulate(s, "2027-05-06").categories[0].current;
  assert.equal(after.carry_cents, 0);
  assert.equal(after.budget_cents, 23000);
  assert.equal(after.remaining_cents, 23000);
  const example = base("2027-03-31", "2027-03-25");
  spend(example, "2027-03-25", 18000);
  assert.equal(
    simulate(example, "2027-03-31").categories[0].current.remaining_cents,
    5000,
  );
  assert.equal(
    simulate(example, "2027-04-01").categories[0].current.remaining_cents,
    23000,
  );
});
test("leap February and December crossovers use the renewal month, not the calendar day 1", () => {
  for (const [start, before, after, total] of [
    ["2024-02-01", "2024-03-01", "2024-03-07", 115000],
    ["2027-02-04", "2027-03-01", "2027-03-04", 92000],
    ["2026-12-31", "2027-01-01", "2027-01-07", 23000],
  ]) {
    const s = base(before, start);
    assert.equal(
      simulate(s, before).categories[0].current.remaining_cents,
      total,
    );
    assert.equal(
      simulate(s, after).categories[0].current.remaining_cents,
      23000,
    );
  }
});
test("spending carry on a card or in a hypothetical purchase preserves safe-to-spend without a second protection", () => {
  const s = base();
  spend(s, "2027-04-01", 18000);
  const before = simulate(s, "2027-04-08");
  const quote = purchaseQuote(s, "2027-04-08", {
    amount: 50,
    account_id: 2,
    category_id: 1,
  });
  assert.equal(quote.available_cents, before.available_cents);
  spend(s, "2027-04-08", 5000, 2);
  const after = simulate(s, "2027-04-08");
  assert.equal(after.categories[0].current.remaining_cents, 23000);
  assert.equal(after.card_cents, 5000);
  assert.equal(after.available_cents, before.available_cents);
});
test("early purchases consume the assigned allocation once; overspends and refunds cannot inflate reports", () => {
  const s = base();
  spend(s, "2027-04-01", 18000);
  const before = simulate(s, "2027-04-08");
  spend(s, "2027-04-08", 5000, 2, "2027-04-15");
  const after = simulate(s, "2027-04-08");
  const a = before.daily.find((d) => d.date === "2027-04-15"),
    b = after.daily.find((d) => d.date === "2027-04-15");
  assert.equal(a.safe_cents, b.safe_cents);
  assert.equal(
    after.categories[0].periods.find((p) => p.date === "2027-04-15")
      .remaining_cents,
    18000,
  );
  const over = base();
  spend(over, "2027-04-01", 30000);
  assert.equal(
    simulate(over, "2027-04-08").categories[0].current.remaining_cents,
    23000,
  );
  const refund = base();
  spend(refund, "2027-04-01", -1000);
  assert.equal(
    simulate(refund, "2027-04-08").categories[0].current.carry_cents,
    23000,
  );
});
test("activation and category start prevent retroactive reports; monthly limits do not carry", () => {
  const s = base();
  s.weekly_rollover_from = "2027-04-08";
  assert.equal(
    simulate(s, "2027-04-08").categories[0].current.remaining_cents,
    23000,
  );
  s.weekly_rollover_from = "2027-04-01";
  s.categories[0].starts_on = "2027-04-08";
  assert.equal(simulate(s, "2027-04-08").categories[0].current.carry_cents, 0);
  s.categories[0].period = "monthly";
  s.categories[0].renewal_day = 1;
  s.categories[0].starts_on = "2027-04-01";
  assert.equal(
    simulate(s, "2027-05-01").categories[0].current.remaining_cents,
    23000,
  );
});
test("upgrade starts this period, saves a copy and keeps activation across JSON restore", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-rollover-"));
  let db = openDatabase(dir);
  t.after(() => {
    try {
      db.db.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const api = createService(db, () => "2026-10-22");
  db.atomic(() =>
    api.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Paie",
          amount: 1000,
          frequency: "weekly",
          start_on: "2026-10-23",
          day_adjust: "none",
        },
      ],
      categories: [
        {
          name: "Épicerie",
          limit: 230,
          period: "weekly",
          renewal_day: 4,
          starts_on: "2026-10-01",
        },
      ],
    }),
  );
  db.run("DELETE FROM settings WHERE key='weekly_rollover_from'");
  db.db.close();
  db = openDatabase(dir);
  assert.equal(db.state().weekly_rollover_from, today());
  assert.equal(
    simulate(db.state(), today()).categories[0].current.carry_cents,
    0,
  );
  assert.equal(
    fs
      .readdirSync(path.join(dir, "backups"))
      .filter((n) => n.startsWith("avant-report-hebdomadaire-")).length,
    1,
  );
  const exported = db.exportData();
  db.restore(exported);
  assert.equal(db.state().weekly_rollover_from, today());
});

test("an early purchase above its next allocation can use carry once, without borrowing across the month reset", () => {
  const s = base();
  spend(s, "2027-04-01", 18000);
  const baseline = simulate(s, "2027-04-08");
  spend(s, "2027-04-08", 50000, 2, "2027-04-15");
  const early = simulate(s, "2027-04-08");
  assert.equal(early.categories[0].current.remaining_cents, 1000);
  assert.equal(early.categories[0].current.advanced_cents, 27000);
  assert.equal(
    early.daily.find((d) => d.date === "2027-04-15").safe_cents,
    baseline.daily.find((d) => d.date === "2027-04-15").safe_cents,
  );
  assert.equal(
    simulate(s, "2027-04-15").categories[0].current.remaining_cents,
    1000,
  );
  const newMonth = base();
  spend(newMonth, "2027-04-01", 18000);
  spend(newMonth, "2027-04-08", 50000, 2, "2027-05-06");
  const after = simulate(newMonth, "2027-04-08");
  assert.equal(after.categories[0].current.remaining_cents, 28000);
  assert.equal(after.categories[0].current.advanced_cents, undefined);
});
