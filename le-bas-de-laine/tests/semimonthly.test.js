import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { periodStart, nextPeriod, occurrences } from "../dates.js";
import { occurrenceInfo } from "../calendar.js";
import { simulate } from "../engine.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { monthlyBudget } from "../budget.js";
const ref = "2026-11-01";
const c = {
  id: 1,
  name: "Maison",
  limit_cents: 7500,
  period: "semimonthly",
  renewal_day: 1,
  renewal_day2: 15,
  starts_on: ref,
  active: 1,
};
const state = () => ({
  accounts: [
    { id: 1, name: "Conjoint", kind: "bank", is_main: 1 },
    { id: 2, name: "Carte", kind: "card" },
  ],
  categories: [{ ...c }],
  transactions: [],
  transfers: [],
  checkpoints: [
    { id: 1, seq: 1, account_id: 1, date: ref, amount_cents: 100000 },
  ],
  recurrences: [],
  occurrence_states: [],
  weekly_rollover_from: ref,
});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-semi-"));
  const db = openDatabase(dir),
    api = createService(db, () => ref);
  t.after(() => {
    db.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dir, db, api };
}
test("two monthly limit dates clamp month-end, survive leap February and yield exactly 24 allocations", () => {
  const cat = { ...c, renewal_day: 15, renewal_day2: 31 };
  assert.equal(periodStart(cat, "2028-02-29"), "2028-02-29");
  assert.equal(nextPeriod(cat, "2028-02-15"), "2028-02-29");
  assert.equal(nextPeriod(cat, "2028-02-29"), "2028-03-15");
  assert.equal(periodStart(cat, "2027-02-01"), "2027-01-31");
  assert.equal(nextPeriod(cat, "2027-02-15"), "2027-02-28");
  let d = "2027-01-15",
    count = 0;
  while (d < "2028-01-01") {
    count++;
    d = nextPeriod(cat, d);
  }
  assert.equal(count, 24);
});
test("semimonthly limits protect each allocation once, no carry, early purchases bank/card and payment parity", () => {
  const s = state();
  const before = simulate(s, ref);
  assert.equal(before.daily[0].safe_cents, 92500);
  assert.equal(before.daily[14].safe_cents, 85000);
  assert.equal(before.spending_30.amount_cents, 85000);
  assert.equal(before.categories[0].current.carry_cents, undefined);
  for (const account_id of [1, 2]) {
    const copy = structuredClone(s);
    copy.transactions.push({
      id: 1,
      seq: 2,
      account_id,
      category_id: 1,
      amount_cents: -5000,
      date: ref,
      period_on: "2026-11-15",
      included: 0,
      settled_cents: 0,
    });
    const after = simulate(copy, ref);
    assert.equal(after.spending_30.amount_cents, 85000);
    assert.equal(after.categories[0].periods[1].remaining_cents, 2500);
    if (account_id === 2) {
      copy.transfers.push({
        id: 1,
        seq: 3,
        from_account_id: 1,
        to_account_id: 2,
        amount_cents: 5000,
        date: ref,
        included: 0,
      });
      assert.equal(simulate(copy, ref).spending_30.amount_cents, 85000);
    }
  }
  const later = simulate(s, "2026-11-15");
  assert.equal(later.categories[0].current.remaining_cents, 7500);
});
test("semimonthly bills have two nominal dates, independent holiday shifts and no 14-day drift", () => {
  const rule = {
    id: 1,
    name: "Facture",
    kind: "expense",
    account_id: 1,
    amount_cents: 10000,
    start_on: ref,
    frequency: "semimonthly",
    second_day: 15,
    day_adjust: "after",
    active: 1,
  };
  assert.deepEqual(
    occurrences(rule, "2026-11-01", "2026-11-30").map((o) => o.date),
    ["2026-11-02", "2026-11-16"],
  );
  const annual = occurrences(
    { ...rule, start_on: "2027-01-01" },
    "2027-01-01",
    "2027-12-31",
  );
  assert.equal(annual.length, 24);
  assert.equal(
    occurrenceInfo("2027-12-10", "semimonthly", 1, "after", false, false, 25)
      .date,
    "2027-12-29",
  );
  assert.equal(
    occurrenceInfo("2028-02-15", "semimonthly", 1, "none", false, false, 31)
      .date,
    "2028-02-29",
  );
  assert.throws(
    () => occurrenceInfo(ref, "semimonthly", 0, "after", false, false, 2),
    /espacez/,
  );
});
test("service validates days, previews two dates, one-time override and remaps saved state when second day changes", (t) => {
  const { db, api } = fixture(t);
  db.atomic(() =>
    api.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Paie",
          amount: 1000,
          frequency: "monthly",
          start_on: "2026-11-25",
          day_adjust: "none",
        },
      ],
      categories: [],
    }),
  );
  const id = api.recurrence({
    name: "Facture",
    kind: "expense",
    amount: 100,
    account_id: 1,
    start_on: ref,
    frequency: "semimonthly",
    second_day: 15,
    day_adjust: "after",
  });
  const preview = api.previewRecurrence({
    id,
    start_on: ref,
    frequency: "semimonthly",
    second_day: 15,
    day_adjust: "after",
  });
  assert.deepEqual(
    preview.dates.map((d) => d.date),
    ["2026-11-02", "2026-11-16", "2026-12-01"],
  );
  db.atomic(() =>
    api.occurrence({
      rule_id: id,
      original_on: "2026-11-16",
      action: "set_amount",
      amount: 80,
    }),
  );
  db.atomic(() =>
    api.recurrence({
      ...db.state().recurrences.find((r) => r.id === id),
      amount: 100,
      second_day: 20,
    }),
  );
  assert.equal(db.state().occurrence_states[0].original_on, "2026-11-20");
  assert.equal(db.state().occurrence_states[0].amount_cents, 8000);
  const events = api
    .snapshot()
    .simulation.daily.flatMap((d) => d.events)
    .filter((e) => e.rule_id === id);
  assert.equal(events.find((e) => e.date === "2026-11-20").amount_cents, 8000);
  assert.equal(events.find((e) => e.date === "2026-12-21").amount_cents, 10000);
  const tables = db.exportData().tables;
  assert.throws(
    () =>
      db.atomic(() =>
        api.category({
          name: "Invalide",
          limit: 100,
          period: "semimonthly",
          renewal_day: 15,
          renewal_day2: 15,
        }),
      ),
    /distincts/,
  );
  assert.throws(
    () =>
      db.atomic(() =>
        api.recurrence({
          name: "Invalide",
          kind: "expense",
          amount: 100,
          account_id: 1,
          start_on: ref,
          frequency: "semimonthly",
          second_day: 1,
        }),
      ),
    /distincts/,
  );
  assert.deepEqual(db.exportData().tables, tables);
});
test("monthly budget uses two allocations and two bills; backup restores second days", (t) => {
  const { db, api } = fixture(t);
  db.atomic(() =>
    api.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Paie",
          amount: 1000,
          frequency: "monthly",
          start_on: "2026-11-25",
          day_adjust: "none",
        },
      ],
      categories: [
        {
          name: "Maison",
          limit: 75,
          period: "semimonthly",
          renewal_day: 1,
          renewal_day2: 15,
        },
      ],
    }),
  );
  api.recurrence({
    name: "Internet",
    kind: "expense",
    amount: 25,
    account_id: 1,
    start_on: ref,
    frequency: "semimonthly",
    second_day: 15,
    day_adjust: "none",
  });
  const budget = monthlyBudget(db.state(), "2026-11", ref);
  assert.equal(budget.expense.planned_cents, 20000);
  assert.equal(
    budget.expense.rows.find((r) => r.name === "Maison").allocation_count,
    2,
  );
  const backup = db.exportData();
  assert.equal(backup.version, 2);
  db.restore(backup);
  assert.equal(db.state().categories[0].renewal_day2, 15);
  assert.equal(db.state().recurrences[1].second_day, 15);
});
test("schema 1 migration backs up intact database and preserves foreign keys, amounts, history and private token", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-schema1-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "budget.sqlite");
  let old = new DatabaseSync(filename);
  old.exec(
    fs.readFileSync(
      new URL("../migrations/001-initial.sql", import.meta.url),
      "utf8",
    ),
  );
  old.exec(
    "INSERT INTO accounts(id,name,kind,is_main) VALUES(1,'Conjoint','bank',1);INSERT INTO categories(id,name,limit_cents,period,renewal_day,starts_on) VALUES(1,'Maison',10000,'monthly',1,'2026-11-01');INSERT INTO recurrences(id,name,kind,amount_cents,account_id,start_on,frequency,day_adjust) VALUES(1,'Facture','expense',1000,1,'2026-11-01','monthly','none');INSERT INTO transactions(id,seq,account_id,category_id,description,amount_cents,date) VALUES(1,1,1,1,'Achat',-1000,'2026-11-01');INSERT INTO occurrence_states(rule_id,original_on,status,transaction_id) VALUES(1,'2026-11-01','paid',1);INSERT OR REPLACE INTO settings(key,value) VALUES('share_token','\"fake-test-token\"'),('sequence','1'),('payment_calendar_version','\"canada-rrq-2026-v2\"'),('weekly_rollover_from','\"2026-11-01\"');",
  );
  const tables = [
    "accounts",
    "categories",
    "transactions",
    "transfers",
    "recurrences",
    "occurrence_states",
    "checkpoints",
    "settings",
  ];
  const payload = {
    format: "le-bas-de-laine",
    version: 1,
    tables: Object.fromEntries(
      tables.map((t) => [t, old.prepare("SELECT * FROM " + t).all()]),
    ),
  };
  old.close();
  const db = openDatabase(dir);
  t.after(() => db.db.close());
  assert.equal(db.q("PRAGMA user_version")[0].user_version, 2);
  assert.equal(db.q("PRAGMA foreign_key_check").length, 0);
  assert.equal(db.setting("share_token"), "fake-test-token");
  for (const table of tables) {
    const rows = db.q("SELECT * FROM " + table).map((r) => {
      const c = { ...r };
      if (table === "categories") delete c.renewal_day2;
      if (table === "recurrences") delete c.second_day;
      return c;
    });
    assert.deepEqual(
      JSON.parse(JSON.stringify(rows)),
      JSON.parse(JSON.stringify(payload.tables[table])),
    );
  }
  const copy = fs
    .readdirSync(path.join(dir, "backups"))
    .find((n) => n.startsWith("avant-schema-2-"));
  assert.ok(copy);
  old = new DatabaseSync(path.join(dir, "backups", copy), { readOnly: true });
  assert.equal(old.prepare("PRAGMA user_version").get().user_version, 1);
  assert.equal(
    old.prepare("SELECT count(*) AS n FROM transactions").get().n,
    1,
  );
  old.close();
  db.restore(payload);
  assert.equal(db.state().categories[0].renewal_day2, null);
  assert.equal(db.state().transactions[0].amount_cents, -1000);
  assert.equal(db.setting("share_token"), "fake-test-token");
});
