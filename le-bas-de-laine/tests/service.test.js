import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { hash, planSillage, applySillage } from "../import.js";
const date = "2026-10-22";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-test-")),
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
          name: "Paie",
          amount: 1000,
          frequency: "biweekly",
          start_on: "2026-10-23",
        },
      ],
      categories: [
        { name: "Épicerie", limit: 230, period: "weekly", renewal_day: 4 },
      ],
    }),
  );
  return {
    db,
    api,
    bank: db.state().accounts[0].id,
    cat: db.state().categories[0].id,
  };
}
test("one atomic setup; malformed setup rolls back entirely", (t) => {
  const { db, api } = fixture(t);
  assert.equal(api.snapshot().configured, true);
  assert.equal(api.snapshot().simulation.available_cents, 77000);
  assert.throws(() => db.atomic(() => api.setup({ balance: 42 })));
  assert.equal(db.state().accounts.length, 1);
});
test("one tap paid creates one transaction and adjusts only that occurrence", (t) => {
  const { db, api, bank } = fixture(t);
  db.atomic(() =>
    api.recurrence({
      name: "Hydro",
      kind: "expense",
      amount: 100,
      account_id: bank,
      start_on: date,
      frequency: "monthly",
    }),
  );
  const o = api
    .snapshot()
    .simulation.upcoming.find((o) => o.kind === "expense");
  db.atomic(() => api.occurrence({ ...o, action: "pay", amount: 90 }));
  assert.equal(db.state().transactions.length, 1);
  assert.equal(api.snapshot().simulation.available_cents, 68000);
  assert.equal(
    db.state().recurrences.find((r) => r.kind === "expense").amount_cents,
    10000,
  );
  assert.throws(() => db.atomic(() => api.occurrence({ ...o, action: "pay" })));
  assert.equal(db.state().transactions.length, 1);
});
test("negative bill payment and impossible periods leave no writes", (t) => {
  const { db, api, bank, cat } = fixture(t);
  db.atomic(() =>
    api.recurrence({
      name: "Hydro",
      kind: "expense",
      amount: 100,
      account_id: bank,
      start_on: date,
      frequency: "monthly",
    }),
  );
  let before = db.exportData().tables;
  const o = api
    .snapshot()
    .simulation.upcoming.find((o) => o.kind === "expense");
  assert.throws(() =>
    db.atomic(() => api.occurrence({ ...o, action: "pay", amount: -50 })),
  );
  assert.deepEqual(db.exportData().tables, before);
  assert.throws(() =>
    db.atomic(() =>
      api.transaction({
        account_id: bank,
        category_id: cat,
        description: "Épicerie",
        amount: -10,
        date,
        period_on: "2026-12-01",
      }),
    ),
  );
  assert.deepEqual(db.exportData().tables, before);
});
test("card history paid/unpaid differs independently from bank included flag", (t) => {
  const { db, api, cat } = fixture(t);
  const card = Number(
    db.run("INSERT INTO accounts(name,kind) VALUES('Carte','card')")
      .lastInsertRowid,
  );
  db.atomic(() =>
    api.transaction({
      account_id: card,
      category_id: cat,
      description: "Historique payé",
      amount: -50,
      date,
      included: true,
      card_settled: true,
    }),
  );
  assert.equal(api.snapshot().simulation.card_cents, 0);
  db.atomic(() =>
    api.transaction({
      account_id: card,
      category_id: cat,
      description: "Non payé",
      amount: -20,
      date,
      included: true,
    }),
  );
  assert.equal(api.snapshot().simulation.card_cents, 2000);
  assert.equal(api.snapshot().simulation.available_cents, 82000);
});
test("a category limit and a fixed bill cannot reserve the same category", (t) => {
  const { db, api, bank, cat } = fixture(t);
  assert.throws(() =>
    db.atomic(() =>
      api.recurrence({
        name: "Épicerie double",
        kind: "expense",
        amount: 230,
        account_id: bank,
        category_id: cat,
        start_on: date,
        frequency: "weekly",
      }),
    ),
  );
  assert.equal(db.state().recurrences.length, 1);
});
test("JSON backup roundtrip preserves every table and malformed restores are atomic", (t) => {
  const { db, api, bank, cat } = fixture(t);
  db.atomic(() =>
    api.transaction({
      account_id: bank,
      category_id: cat,
      description: "Épicerie",
      amount: -71.69,
      date,
    }),
  );
  const backup = db.exportData(),
    forecast = api.snapshot().simulation;
  db.atomic(() => api.checkpoint({ account_id: bank, amount: 1 }));
  db.restore(backup);
  assert.deepEqual(db.exportData().tables, backup.tables);
  assert.deepEqual(api.snapshot().simulation, forecast);
  const bad = structuredClone(backup);
  bad.tables.transactions[0].amount_cents = "not money";
  assert.throws(() => db.restore(bad));
  assert.deepEqual(db.exportData().tables, backup.tables);
  assert.ok(
    fs
      .readdirSync(path.join(db.dir, "backups"))
      .some((n) => n.startsWith("avant-restauration")),
  );
});
test("daily SQLite backups are coherent and do not replace the first snapshot", (t) => {
  const { db } = fixture(t);
  const target = db.daily(date),
    bytes = fs.readFileSync(target);
  db.run("UPDATE accounts SET name='Autre nom'");
  assert.equal(db.daily(date), target);
  assert.deepEqual(fs.readFileSync(target), bytes);
});
function source() {
  return {
    format: "mon-budget",
    version: 1,
    created_at: "2026-10-22T16:00:00Z",
    tables: {
      accounts: [
        {
          id: 1,
          name: "Conjoint",
          kind: "checking",
          included: 1,
          balance_cents: 100000,
        },
        {
          id: 2,
          name: "Carte",
          kind: "credit",
          included: 0,
          balance_cents: 7169,
        },
      ],
      categories: [{ id: 1, name: "Épicerie", archived: 0 }],
      envelopes: [
        {
          id: 1,
          name: "Épicerie",
          active: 1,
          budget_cents: 23000,
          reserved_cents: 15831,
          frequency: "weekly",
          start_on: "2026-10-15",
          forecast_spend: 0,
          rollover: 0,
        },
      ],
      transactions: [
        {
          id: 1,
          account_id: 2,
          category_id: 1,
          envelope_id: 1,
          amount_cents: -7169,
          description: "Épicerie",
          happened_on: date,
          affects_balance: 1,
        },
      ],
      account_transfers: [],
      recurring: [
        {
          id: 1,
          description: "Paie",
          type: "income",
          amount_cents: 100000,
          account_id: 1,
          start_on: "2026-10-23",
          frequency: "biweekly",
          active: 1,
        },
      ],
      app_settings: [],
      recurring_overrides: [],
      reconciliation_links: [],
      recurring_moves: [],
    },
  };
}
function importFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-import-")),
    db = openDatabase(dir),
    api = createService(db, () => date);
  t.after(() => {
    db.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { db, api };
}
test("Sillage import retains history, exact bank and current unpaid groceries", (t) => {
  const { db, api } = importFixture(t),
    backup = source();
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  const s = api.snapshot();
  assert.equal(s.simulation.bank_cents, 100000);
  assert.equal(s.simulation.card_cents, 7169);
  assert.equal(s.simulation.available_cents, 77000);
  assert.equal(s.transactions.length, 1);
});
test("repeat import is a true no-op and source changes update the same row", (t) => {
  const { db, api } = importFixture(t),
    backup = source();
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  const tables = db.exportData().tables;
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  assert.deepEqual(db.exportData().tables, tables);
  backup.tables.transactions[0].amount_cents = -8000;
  backup.tables.accounts[1].balance_cents = 8000;
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  assert.equal(db.state().transactions.length, 1);
  assert.equal(db.state().transactions[0].id, tables.transactions[0].id);
  assert.equal(api.snapshot().simulation.card_cents, 8000);
  assert.equal(api.snapshot().simulation.available_cents, 77000);
});
test("local/source edits and source deletions become conflicts instead of silent overwrites", (t) => {
  const { db, api } = importFixture(t),
    backup = source();
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  const tx = db.state().transactions[0];
  db.atomic(() =>
    api.transaction({
      id: tx.id,
      account_id: tx.account_id,
      category_id: tx.category_id,
      description: "Correction locale",
      amount: -75,
      date,
      included: true,
    }),
  );
  backup.tables.transactions[0].amount_cents = -80;
  const plan = planSillage(backup, date, db.state());
  assert.ok(plan.conflicts.length);
  const before = db.exportData().tables;
  assert.throws(() => db.atomic(() => applySillage(db, plan)));
  assert.deepEqual(db.exportData().tables, before);
  backup.tables.transactions = [];
  assert.ok(
    planSillage(backup, date, db.state()).conflicts.some((c) =>
      c.message.startsWith("Absent"),
    ),
  );
});
test("editing an imported unpaid card purchase changes protection without a fabricated debt", (t) => {
  const { db, api } = importFixture(t),
    backup = source();
  db.atomic(() => applySillage(db, planSillage(backup, date, db.state())));
  const tx = db.state().transactions[0];
  db.atomic(() =>
    api.transaction({
      id: tx.id,
      account_id: tx.account_id,
      category_id: tx.category_id,
      description: tx.description,
      amount: -60,
      date,
      included: true,
    }),
  );
  assert.equal(api.snapshot().simulation.card_cents, 6000);
  assert.equal(api.snapshot().simulation.available_cents, 77000);
});
test("Autres remains opt-in on existing budgets and its catch-all identity survives export/restore", (t) => {
  const { db, api, bank } = fixture(t);
  assert.equal(db.state().fallback_category_id, null);
  assert.equal(api.snapshot().simulation.available_cents, 77000);
  const other = db.atomic(() =>
    api.category({
      name: "Autres",
      limit: 50,
      period: "monthly",
      renewal_day: 1,
    }),
  );
  const house = db.atomic(() => api.category({ name: "Maison" }));
  assert.equal(db.state().fallback_category_id, other);
  assert.equal(api.snapshot().simulation.available_cents, 72000);
  db.atomic(() =>
    api.transaction({
      account_id: bank,
      category_id: house,
      description: "Maison",
      amount: -20,
      date,
    }),
  );
  assert.equal(api.snapshot().simulation.available_cents, 72000);
  const backup = db.exportData();
  db.restore(backup);
  assert.equal(db.state().fallback_category_id, other);
  assert.equal(
    api.snapshot().simulation.categories.find((c) => c.id === other).current
      .remaining_cents,
    3000,
  );
  const bad = structuredClone(backup);
  bad.tables.settings.find((s) => s.key === "fallback_category_id").value =
    "999999";
  assert.throws(() => db.restore(bad));
  assert.deepEqual(db.exportData().tables, backup.tables);
});
test("adding a limit to a legacy Autres category reuses its identity instead of creating a duplicate", (t) => {
  const { db, api } = fixture(t);
  const old = db.atomic(() => api.category({ name: "Autres" }));
  assert.equal(db.state().fallback_category_id, null);
  const updated = db.atomic(() =>
    api.category({
      name: "Autres",
      limit: 50,
      period: "monthly",
      renewal_day: 1,
    }),
  );
  assert.equal(updated, old);
  assert.equal(
    db.state().categories.filter((c) => c.name === "Autres").length,
    1,
  );
  assert.equal(db.state().fallback_category_id, old);
});
test("date previews are read-only and show adjusted month-end dates", (t) => {
  const { db, api } = fixture(t),
    before = db.exportData().tables;
  const p = api.previewRecurrence({
    frequency: "last_day",
    start_on: "2027-01-12",
    day_adjust: "after",
  });
  assert.equal(p.dates.length, 3);
  assert.deepEqual(p.dates[0], {
    nominal: "2027-01-31",
    date: "2027-02-01",
    shifted: true,
    manual: false,
  });
  assert.deepEqual(db.exportData().tables, before);
});
test("changing a weekend rule preserves paid occurrence identity and actual transaction date", (t) => {
  const { db, api, bank } = fixture(t);
  const id = db.atomic(() =>
    api.recurrence({
      name: "Facture dimanche",
      kind: "expense",
      amount: 50,
      account_id: bank,
      start_on: "2026-10-25",
      frequency: "monthly",
      day_adjust: "none",
    }),
  );
  db.atomic(() =>
    api.occurrence({ rule_id: id, original_on: "2026-10-25", action: "pay" }),
  );
  const original = db.state().transactions[0];
  const safe = api.snapshot().simulation.available_cents;
  for (const [mode, key] of [
    ["before", "2026-10-23"],
    ["after", "2026-10-26"],
    ["none", "2026-10-25"],
  ]) {
    db.atomic(() =>
      api.recurrence({
        id,
        name: "Facture dimanche",
        kind: "expense",
        amount: 50,
        account_id: bank,
        start_on: "2026-10-25",
        frequency: "monthly",
        day_adjust: mode,
      }),
    );
    assert.equal(
      db.state().occurrence_states.find((s) => s.rule_id === id).original_on,
      key,
    );
    assert.equal(db.state().transactions.length, 1);
    assert.equal(db.state().transactions[0].date, original.date);
    assert.equal(api.snapshot().simulation.available_cents, safe);
    assert.ok(
      !api
        .previewRecurrence({
          id,
          start_on: "2026-10-25",
          frequency: "monthly",
          day_adjust: mode,
        })
        .dates.some((d) => d.date === key),
    );
  }
});
test("month-end edits preserve a manually postponed occurrence and cancellation", (t) => {
  const { db, api, bank } = fixture(t);
  const id = db.atomic(() =>
    api.recurrence({
      name: "Mensuel",
      kind: "expense",
      amount: 50,
      account_id: bank,
      start_on: "2027-01-15",
      frequency: "monthly",
    }),
  );
  db.atomic(() =>
    api.occurrence({
      rule_id: id,
      original_on: "2027-01-15",
      action: "postpone",
      date: "2027-02-03",
    }),
  );
  db.atomic(() =>
    api.occurrence({
      rule_id: id,
      original_on: "2027-02-15",
      action: "cancel",
    }),
  );
  db.atomic(() =>
    api.recurrence({
      id,
      name: "Mensuel",
      kind: "expense",
      amount: 50,
      account_id: bank,
      start_on: "2027-01-15",
      frequency: "last_day",
      day_adjust: "after",
    }),
  );
  const rows = db.state().occurrence_states.filter((s) => s.rule_id === id);
  assert.equal(
    rows.find((s) => s.status === "postponed").original_on,
    "2027-02-01",
  );
  assert.equal(
    rows.find((s) => s.status === "postponed").postponed_on,
    "2027-02-03",
  );
  assert.equal(
    rows.find((s) => s.status === "cancelled").original_on,
    "2027-03-01",
  );
});
test("name/amount updates without calendar fields do not reset an existing business-day adjustment", (t) => {
  const { db, api, bank } = fixture(t);
  const id = db.atomic(() =>
    api.recurrence({
      name: "A",
      kind: "expense",
      amount: 50,
      account_id: bank,
      start_on: "2026-10-25",
      frequency: "monthly",
      day_adjust: "before",
      one_time: true,
    }),
  );
  db.atomic(() =>
    api.recurrence({
      id,
      name: "B",
      kind: "expense",
      amount: 55,
      account_id: bank,
      start_on: "2026-10-25",
      frequency: "monthly",
    }),
  );
  const rule = db.state().recurrences.find((r) => r.id === id);
  assert.equal(rule.day_adjust, "before");
  assert.equal(rule.one_time, 1);
  const before = db.exportData().tables;
  assert.throws(() =>
    db.atomic(() =>
      api.recurrence({
        id,
        name: "B",
        kind: "expense",
        amount: 55,
        account_id: bank,
        start_on: "2026-10-25",
        frequency: "monthly",
        day_adjust: "invalid",
      }),
    ),
  );
  assert.deepEqual(db.exportData().tables, before);
});

test("new calendar defaults depend on intent, existing explicit choices survive edits", (t) => {
  const { db, api, bank } = fixture(t);
  for (const kind of ["income", "expense", "transfer"]) {
    const secondary = Number(
      db.run("INSERT INTO accounts(name,kind) VALUES('Épargne','bank')")
        .lastInsertRowid,
    );
    const id = db.atomic(() =>
      api.recurrence({
        name: kind,
        kind,
        account_id: bank,
        to_account_id: secondary,
        amount: 10,
        start_on: "2026-11-15",
        frequency: "monthly",
      }),
    );
    const r = db.state().recurrences.find((r) => r.id === id);
    assert.equal(r.day_adjust, kind === "income" ? "before" : "after");
    db.atomic(() => api.recurrence({ ...r, amount: 10, day_adjust: "none" }));
    db.atomic(() =>
      api.recurrence({ ...r, amount: 11, day_adjust: undefined }),
    );
    assert.equal(
      db.state().recurrences.find((r) => r.id === id).day_adjust,
      "none",
    );
  }
});
test("secondary bank checkpoint changes savings without changing main available", (t) => {
  const { db, api } = fixture(t);
  const before = api.snapshot().simulation.available_cents;
  const id = Number(
    db.run("INSERT INTO accounts(name,kind) VALUES('Épargne','bank')")
      .lastInsertRowid,
  );
  db.atomic(() => api.checkpoint({ account_id: id, amount: 500 }));
  assert.equal(
    api.snapshot().account_balances.find((a) => a.id === id).balance_cents,
    50000,
  );
  assert.equal(api.snapshot().simulation.available_cents, before);
});

test("Sillage June payment imports into its national key and can be reimported without duplicates", (t) => {
  const { db } = importFixture(t),
    backup = source();
  backup.tables.envelopes = [];
  backup.tables.transactions = [
    {
      id: 1,
      account_id: 1,
      category_id: 1,
      amount_cents: -1000,
      description: "Facture juin",
      happened_on: "2026-06-25",
      affects_balance: 1,
    },
  ];
  backup.tables.recurring = [
    {
      id: 1,
      description: "Facture juin",
      type: "expense",
      amount_cents: 1000,
      account_id: 1,
      start_on: "2026-06-24",
      frequency: "monthly",
      day_adjust: "after",
      active: 1,
    },
  ];
  backup.tables.reconciliation_links = [
    { recurring_id: 1, occurrence_on: "2026-06-25", transaction_id: 1 },
  ];
  for (let i = 0; i < 2; i++)
    db.atomic(() =>
      applySillage(db, planSillage(backup, "2026-06-26", db.state())),
    );
  const states = db.state().occurrence_states;
  assert.equal(
    states.filter((s) => s.original_on === "2026-06-24" && s.status === "paid")
      .length,
    1,
  );
  assert.equal(
    states.some((s) => s.original_on === "2026-06-25"),
    false,
  );
  assert.equal(db.state().transactions.length, 1);
});
