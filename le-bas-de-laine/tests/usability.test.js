import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pendingIncome } from "../pending-income.js";
import { recentMerchants, recentFor } from "../public/recent.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
const date = "2026-11-02";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-usability-")),
    db = openDatabase(dir),
    api = createService(db, () => date);
  t.after(() => {
    db.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  db.atomic(() =>
    api.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Allocation",
          amount: 100,
          start_on: date,
          frequency: "monthly",
          day_adjust: "none",
        },
      ],
      categories: [],
    }),
  );
  return { db, api };
}
test("pending-income explanation includes today and recent past, respects states/postponements and does not mutate forecasts", (t) => {
  const { db, api } = fixture(t);
  const before = api.snapshot().simulation;
  assert.equal(api.snapshot().pending_income.length, 1);
  assert.equal(api.snapshot().pending_income[0].date, date);
  assert.deepEqual(api.snapshot().simulation, before);
  const data = db.state();
  data.occurrence_states = [
    {
      rule_id: 1,
      original_on: date,
      status: "postponed",
      postponed_on: "2026-11-03",
      amount_cents: 7500,
    },
  ];
  assert.equal(pendingIncome(data, date).length, 0);
  data.occurrence_states[0].postponed_on = "2026-11-01";
  assert.equal(pendingIncome(data, date)[0].amount_cents, 7500);
  for (const status of ["paid", "cancelled"]) {
    data.occurrence_states[0].status = status;
    assert.equal(pendingIncome(data, date).length, 0);
  }
});
test("receipt of new money increases cash once and keeps the habitual recurrence untouched", (t) => {
  const { db, api } = fixture(t);
  db.atomic(() =>
    api.occurrence({
      rule_id: 1,
      original_on: date,
      action: "set_amount",
      amount: 75,
    }),
  );
  const before = api.snapshot();
  db.atomic(() =>
    api.occurrence({
      rule_id: 1,
      original_on: date,
      action: "pay",
      date,
      amount: 75,
      included: false,
    }),
  );
  const after = api.snapshot();
  assert.equal(
    after.simulation.bank_cents - before.simulation.bank_cents,
    7500,
  );
  assert.equal(after.pending_income.length, 0);
  assert.equal(after.recurrences[0].amount_cents, 10000);
  assert.equal(after.transactions.length, 1);
  assert.throws(
    () =>
      db.atomic(() =>
        api.occurrence({
          rule_id: 1,
          original_on: date,
          action: "pay",
          amount: 75,
        }),
      ),
    /réglée/,
  );
  assert.equal(db.state().transactions.length, 1);
});
test("receipt already included in the verified bank balance closes the plan without adding cash again", (t) => {
  const { db, api } = fixture(t);
  const before = api.snapshot();
  db.atomic(() =>
    api.occurrence({
      rule_id: 1,
      original_on: date,
      action: "pay",
      date,
      amount: 100,
      included: true,
    }),
  );
  const after = api.snapshot();
  assert.equal(after.simulation.bank_cents, before.simulation.bank_cents);
  assert.equal(
    after.simulation.spending_30.amount_cents,
    before.simulation.spending_30.amount_cents,
  );
  assert.equal(after.transactions[0].included, 1);
  assert.equal(after.pending_income.length, 0);
});
test("recent merchant suggestions normalize labelled branch IDs, prefer actual recent dates and never reuse amount/period", (t) => {
  const { db, api } = fixture(t);
  const data = db.state();
  data.accounts.push({ id: 2, name: "Carte", kind: "card" });
  data.transactions = [
    {
      id: 1,
      seq: 4,
      date: "2026-11-01",
      description: "IGA #1234",
      account_id: 2,
      category_id: null,
      amount_cents: -9000,
    },
    {
      id: 2,
      seq: 5,
      date: "2025-01-01",
      description: "IGA #2345",
      account_id: 1,
      category_id: null,
      amount_cents: -500,
    },
    {
      id: 3,
      seq: 3,
      date: "2026-11-01",
      description: "Route 132",
      account_id: 1,
      category_id: null,
      amount_cents: -600,
    },
    {
      id: 4,
      seq: 2,
      date: "2026-11-01",
      description: "Route 138",
      account_id: 1,
      category_id: null,
      amount_cents: -700,
    },
  ];
  const before = JSON.stringify(data);
  assert.equal(recentMerchants(data).length, 3);
  assert.equal(recentFor(data, "iga #9988", "expense").account_id, 2);
  assert.equal(recentFor(data, "IGA", "income"), null);
  assert.equal(JSON.stringify(data), before);
});
