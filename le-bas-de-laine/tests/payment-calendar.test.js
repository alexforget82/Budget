import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { holidaySet, shiftDate, occurrenceInfo } from "../calendar.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { calendarStateChanges } from "../calendar-state.js";
// Supplied by the user, not downloaded or independently authenticated.
const supplied = {
  2026: [
    "01-01",
    "04-03",
    "05-18",
    "07-01",
    "09-07",
    "09-30",
    "10-12",
    "11-11",
    "12-25",
    "12-28",
  ],
  2027: [
    "01-01",
    "03-26",
    "05-24",
    "07-01",
    "09-06",
    "09-30",
    "10-11",
    "11-11",
    "12-27",
    "12-28",
  ],
};
for (const [year, days] of Object.entries(supplied))
  test(
    "exact payment-system closures from user-supplied " + year + " table",
    () => {
      assert.deepEqual(
        [...holidaySet(+year)].sort(),
        days.map((d) => year + "-" + d).sort(),
      );
    },
  );
test("provincial/industry/provider holidays do not close the national system", () => {
  for (const date of [
    "2027-01-04",
    "2027-02-15",
    "2027-03-29",
    "2027-06-21",
    "2027-06-24",
    "2027-07-09",
    "2027-08-02",
    "2027-08-16",
  ])
    assert.equal(shiftDate(date, "after"), date);
  assert.equal(shiftDate("2026-12-25", "after"), "2026-12-29");
  assert.equal(shiftDate("2027-12-25", "after"), "2027-12-29");
  assert.equal(shiftDate("2028-01-01", "after"), "2028-01-04");
  assert.equal(shiftDate("2028-01-04", "after"), "2028-01-04");
});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-calendar-migration-"));
  let store = openDatabase(dir);
  t.after(() => {
    try {
      store.db.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const service = createService(store, () => "2026-06-20");
  store.atomic(() =>
    service.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Paie",
          amount: 1000,
          start_on: "2026-07-01",
          frequency: "monthly",
          day_adjust: "none",
        },
      ],
      bills: [
        {
          name: "Facture juin",
          amount: 10,
          start_on: "2026-06-24",
          frequency: "monthly",
          day_adjust: "after",
        },
      ],
    }),
  );
  return {
    dir,
    store,
    service,
    reopen: () => {
      store.db.close();
      store = openDatabase(dir);
      return store;
    },
  };
}
test("calendar correction preserves paid bills with a coherent backup and runs once", (t) => {
  const f = fixture(t),
    r = f.store.state().recurrences.find((r) => r.kind === "expense");
  f.store.atomic(() => {
    const id = f.service.transaction({
      account_id: r.account_id,
      description: "Facture",
      amount: -10,
      date: "2026-06-19",
    });
    f.store.run(
      "INSERT INTO occurrence_states(rule_id,original_on,status,transaction_id) VALUES(?,?,'paid',?)",
      r.id,
      "2026-06-25",
      id,
    );
    f.store.run("DELETE FROM settings WHERE key='payment_calendar_version'");
  });
  const transactions = JSON.stringify(f.store.state().transactions),
    store = f.reopen();
  assert.equal(store.state().occurrence_states[0].original_on, "2026-06-24");
  assert.equal(JSON.stringify(store.state().transactions), transactions);
  assert.equal(
    createService(store, () => "2026-06-20")
      .snapshot()
      .simulation.upcoming.some((e) => e.rule_id === r.id),
    false,
  );
  assert.equal(
    fs
      .readdirSync(path.join(f.dir, "backups"))
      .filter((n) => n.startsWith("avant-calendrier-canadien-")).length,
    1,
  );
  store.reconcileCalendar();
  assert.equal(
    fs
      .readdirSync(path.join(f.dir, "backups"))
      .filter((n) => n.startsWith("avant-calendrier-canadien-")).length,
    1,
  );
});
test("restoring a pre-correction backup keeps manual postponement, cancellation and actual purchases", (t) => {
  const f = fixture(t),
    r = f.store.state().recurrences.find((r) => r.kind === "expense");
  const payload = f.store.exportData();
  payload.tables.settings = payload.tables.settings.filter(
    (s) => s.key !== "payment_calendar_version",
  );
  payload.tables.occurrence_states.push({
    rule_id: r.id,
    original_on: "2026-06-25",
    status: "postponed",
    postponed_on: "2026-06-29",
    amount_cents: 900,
    transaction_id: null,
    transfer_id: null,
  });
  f.store.restore(payload);
  const row = f.store.state().occurrence_states[0];
  assert.equal(row.original_on, "2026-06-24");
  assert.equal(row.postponed_on, "2026-06-29");
  assert.equal(row.amount_cents, 900);
  const view = createService(f.store, () => "2026-06-20").snapshot();
  assert.equal(
    view.simulation.upcoming.find((e) => e.rule_id === r.id).date,
    "2026-06-29",
  );
});
test("legacy re-keying recognizes previous-day rules and protects against collisions", () => {
  const recurrence = {
    id: 1,
    start_on: "2026-06-24",
    frequency: "monthly",
    day_adjust: "before",
    one_time: 1,
  };
  const state = {
    recurrences: [recurrence],
    occurrence_states: [
      { rule_id: 1, original_on: "2026-06-23", status: "cancelled" },
    ],
  };
  assert.equal(
    calendarStateChanges(state)[0].rows[0].original_on,
    "2026-06-24",
  );
  state.occurrence_states.push({
    rule_id: 1,
    original_on: "2026-06-24",
    status: "paid",
  });
  assert.throws(() => calendarStateChanges(state), /Conflit/);
  assert.equal(
    occurrenceInfo("2026-06-24", "monthly", 0, "after").date,
    "2026-06-24",
  );
});
