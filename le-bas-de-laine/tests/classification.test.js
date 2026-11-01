import { DatabaseSync } from "node:sqlite";
import { simulate } from "../engine.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { matchingRule, normalizeMerchant } from "../classification.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { previewCSV } from "../csv.js";
const date = "2026-11-10";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-rules-"));
  const db = openDatabase(dir),
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
          start_on: "2026-11-25",
          frequency: "monthly",
          day_adjust: "none",
        },
      ],
      categories: [
        { name: "Épicerie", limit: 100, period: "monthly", renewal_day: 1 },
      ],
    }),
  );
  return { db, api, dir };
}
const rule = (id, extra = {}) => ({
  id,
  priority: 100,
  match_type: "contains",
  pattern: "IGA",
  account_id: null,
  direction: "expense",
  min_cents: null,
  max_cents: null,
  category_id: 1,
  active: 1,
  ...extra,
});
test("merchant normalization removes labelled location numbers but preserves meaningful numbers and honors priority/conditions", () => {
  assert.equal(
    normalizeMerchant("  Épicerie IGA #4521 Terminal 003 "),
    "EPICERIE IGA",
  );
  assert.equal(normalizeMerchant("Route 132"), "ROUTE 132");
  assert.equal(normalizeMerchant("IGA 0873"), "IGA 0873");
  const state = {
    rules: [
      rule(1),
      rule(2, {
        priority: 10,
        min_cents: 15000,
        account_id: 2,
        category_id: 2,
      }),
      rule(3, { priority: 1, active: 0 }),
    ],
    occurrence_states: [],
  };
  const tx = {
    id: 1,
    description: "IGA #4521",
    amount_cents: -18000,
    account_id: 2,
  };
  assert.equal(matchingRule(state, tx).id, 2);
  assert.equal(matchingRule(state, { ...tx, account_id: 1 }).id, 1);
  assert.equal(matchingRule(state, { ...tx, amount_cents: 18000 }), null);
  state.rules = [rule(1, { match_type: "equals" })];
  assert.ok(matchingRule(state, tx));
  assert.equal(matchingRule(state, { ...tx, description: "IGA 0873" }), null);
  state.rules = [rule(1, { match_type: "starts" })];
  assert.equal(matchingRule(state, { ...tx, description: "ACHAT IGA" }), null);
  state.occurrence_states = [{ status: "paid", transaction_id: 1 }];
  assert.equal(matchingRule(state, tx), null);
});
test("saving rules and review flags cannot change any daily financial calculation; remember-rule is atomic", (t) => {
  const { db, api } = fixture(t);
  const id = api.transaction({
    description: "IGA",
    amount: -20,
    account_id: 1,
    category_id: 1,
    date,
  });
  const before = api.snapshot().simulation;
  const rid = api.classificationRule({
    pattern: "IGA",
    match_type: "contains",
    direction: "expense",
    category_id: 1,
  });
  assert.deepEqual(api.snapshot().simulation, before);
  assert.equal(db.state().transactions[0].reviewed, 1);
  db.run("UPDATE transactions SET reviewed=0 WHERE id=?", id);
  assert.equal(api.snapshot().review_count, 1);
  assert.deepEqual(api.snapshot().review_rule_ids, [id]);
  db.atomic(() => api.reviewBatch({ action: "review_rules", ids: [id] }, true));
  assert.equal(api.snapshot().review_count, 0);
  assert.deepEqual(api.snapshot().simulation, before);
  api.deleteClassificationRule({ id: rid });
  assert.deepEqual(api.snapshot().simulation, before);
  const original = db.exportData().tables;
  assert.throws(
    () =>
      db.atomic(() =>
        api.transaction({
          description: "Autre",
          amount: -5,
          account_id: 1,
          category_id: null,
          date,
          remember_rule: true,
        }),
      ),
    /invalide/,
  );
  assert.deepEqual(db.exportData().tables, original);
  db.atomic(() =>
    api.transaction({
      description: "IGA #1234",
      amount: -10,
      account_id: 1,
      category_id: 1,
      date,
      remember_rule: true,
    }),
  );
  assert.equal(db.state().rules.length, 1);
});
test("CSV rule suggestions are overridable and paid occurrences never match classification rules", (t) => {
  const { db, api } = fixture(t);
  const other = api.category({ name: "Autre" });
  api.classificationRule({
    pattern: "IGA",
    match_type: "contains",
    direction: "expense",
    category_id: 1,
  });
  const csv = "Date;Description;Montant\n2026-11-10;IGA #4521;-20,00";
  const proposed = previewCSV(csv, { account_id: 1 }, db.state(), api);
  assert.equal(proposed.rows[0].category_id, 1);
  assert.ok(proposed.rows[0].classification_rule_id);
  assert.equal(
    previewCSV(csv, { account_id: 1, category_id: other }, db.state(), api)
      .rows[0].category_id,
    other,
  );
  const r = api.recurrence({
    name: "IGA",
    kind: "expense",
    amount: 20,
    account_id: 1,
    start_on: date,
    frequency: "monthly",
    day_adjust: "none",
  });
  db.atomic(() =>
    api.occurrence({ rule_id: r, original_on: date, action: "pay", date }),
  );
  const tx = db.state().transactions[0];
  assert.equal(
    api.classify({ id: tx.id, description: "IGA", amount: -20, account_id: 1 }),
    null,
  );
  assert.throws(
    () => api.reviewBatch({ action: "category", ids: [tx.id], category_id: 1 }),
    /liées/,
  );
});
test("bulk classification previews exact safe-to-spend, rejects stale token and preserves bank/card/checkpoint fields", (t) => {
  const { db, api } = fixture(t);
  const card = Number(
    db.run("INSERT INTO accounts(name,kind) VALUES('Carte','card')")
      .lastInsertRowid,
  );
  const id = api.transaction({
    description: "IGA",
    amount: -20,
    account_id: card,
    date,
    reviewed: false,
  });
  const old = db.state().transactions[0],
    checkpoints = db.state().checkpoints;
  const request = { action: "category", ids: [id], category_id: 1 };
  const preview = api.reviewBatch(request);
  assert.ok(preview.after_cents > preview.before_cents);
  assert.equal(preview.difference_cents, 2000);
  assert.equal(db.state().transactions[0].category_id, null);
  assert.throws(
    () =>
      db.atomic(() => api.reviewBatch({ ...request, token: "invalid" }, true)),
    /aperçu/,
  );
  db.atomic(() => api.reviewBatch({ ...request, token: preview.token }, true));
  const current = db.state().transactions[0];
  for (const key of [
    "id",
    "seq",
    "account_id",
    "amount_cents",
    "date",
    "included",
    "settled_cents",
    "reviewed",
  ])
    assert.equal(current[key], old[key]);
  assert.deepEqual(db.state().checkpoints, checkpoints);
  assert.equal(current.category_id, 1);
  assert.equal(
    api.snapshot().simulation.spending_30.amount_cents,
    preview.after_cents,
  );
});
test("JSON 3 preserves rules and review flags; old JSON 2 restores with reviewed history and no rules", (t) => {
  const { db, api } = fixture(t);
  api.classificationRule({
    pattern: "IGA",
    match_type: "contains",
    direction: "expense",
    category_id: 1,
  });
  api.transaction({
    description: "IGA",
    amount: -20,
    account_id: 1,
    category_id: 1,
    date,
    reviewed: false,
  });
  const backup = db.exportData();
  assert.equal(backup.version, 3);
  db.restore(backup);
  assert.equal(db.state().rules.length, 1);
  assert.equal(db.state().transactions[0].reviewed, 0);
  const old = structuredClone(backup);
  old.version = 2;
  delete old.tables.rules;
  for (const tx of old.tables.transactions) delete tx.reviewed;
  db.restore(old);
  assert.equal(db.state().rules.length, 0);
  assert.equal(db.state().transactions[0].reviewed, 1);
  const bad = structuredClone(backup);
  bad.tables.rules[0].min_cents = 200;
  bad.tables.rules[0].max_cents = 100;
  const before = db.exportData().tables;
  assert.throws(() => db.restore(bad), /Bornes/);
  assert.deepEqual(db.exportData().tables, before);
});

test("schema 2 migration keeps the financial ledger unchanged and backs up original reviewed-free rows", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-review-migration-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const old = new DatabaseSync(path.join(dir, "budget.sqlite"));
  old.exec(
    fs.readFileSync(
      new URL("../migrations/001-initial.sql", import.meta.url),
      "utf8",
    ),
  );
  old.exec(
    fs.readFileSync(
      new URL("../migrations/002-semimonthly.sql", import.meta.url),
      "utf8",
    ),
  );
  old.exec(
    "INSERT INTO accounts(id,name,kind,is_main) VALUES(1,'Conjoint','bank',1);INSERT INTO categories(id,name,limit_cents,period,renewal_day,starts_on) VALUES(1,'Maison',10000,'monthly',1,'2026-11-01');INSERT INTO checkpoints(id,seq,account_id,amount_cents,date,difference_cents) VALUES(1,1,1,100000,'2026-11-10',100000);INSERT INTO transactions(id,seq,account_id,category_id,description,amount_cents,date) VALUES(1,2,1,1,'Achat',-2000,'2026-11-10');UPDATE settings SET value='2' WHERE key='sequence';",
  );
  const names = [
    "accounts",
    "categories",
    "transactions",
    "transfers",
    "recurrences",
    "occurrence_states",
    "checkpoints",
  ];
  const original = Object.fromEntries(
    names.map((name) => [name, old.prepare("SELECT * FROM " + name).all()]),
  );
  old.close();
  const before = simulate(original, date),
    db = openDatabase(dir);
  t.after(() => db.db.close());
  assert.equal(db.q("PRAGMA user_version")[0].user_version, 3);
  assert.equal(db.state().transactions[0].reviewed, 1);
  assert.deepEqual(db.state().rules, []);
  assert.deepEqual(simulate(db.state(), date), before);
  const name = fs
    .readdirSync(path.join(dir, "backups"))
    .find((x) => x.startsWith("avant-schema-3-"));
  assert.ok(name);
  const copy = new DatabaseSync(path.join(dir, "backups", name), {
    readOnly: true,
  });
  assert.equal(copy.prepare("PRAGMA user_version").get().user_version, 2);
  assert.ok(
    !copy
      .prepare("PRAGMA table_info(transactions)")
      .all()
      .some((c) => c.name === "reviewed"),
  );
  copy.close();
});
