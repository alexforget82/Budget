import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database.js";
import { install } from "../install.js";
import { rollback } from "../rollback.js";
const release = path.resolve(import.meta.dirname, "..");
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-recovery-")),
    root = path.join(home, ".local/share/le-bas-de-laine"),
    data = path.join(root, "data");
  fs.mkdirSync(data, { recursive: true });
  fs.mkdirSync(path.join(root, "app"));
  fs.writeFileSync(
    path.join(root, "app/package.json"),
    JSON.stringify({ name: "le-bas-de-laine", version: "0.8.0" }),
  );
  fs.writeFileSync(path.join(root, "app/marker"), "previous program");
  const db = new DatabaseSync(path.join(data, "budget.sqlite"));
  for (const n of ["001-initial", "002-semimonthly"])
    db.exec(
      fs.readFileSync(path.join(release, "migrations", n + ".sql"), "utf8"),
    );
  db.exec(
    "INSERT INTO accounts(id,name,kind,is_main) VALUES(1,'Conjoint','bank',1);INSERT INTO checkpoints(id,seq,account_id,amount_cents,date,difference_cents) VALUES(1,1,1,100000,'2026-11-01',100000);UPDATE settings SET value='1' WHERE key='sequence';INSERT INTO settings(key,value) VALUES('configured','true'),('share_token','\"fake-shared-token\"'),('payment_calendar_version','\"canada-rrq-2026-v2\"'),('weekly_rollover_from','\"2026-11-01\"');",
  );
  db.close();
  fs.writeFileSync(
    path.join(data, "private-access.json"),
    JSON.stringify({
      origin: "https://fake.example.ts.net:8443",
      login: "fake@example.com",
    }),
  );
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return { home, root, data };
}
function inspect(data) {
  const db = new DatabaseSync(path.join(data, "budget.sqlite"), {
    readOnly: true,
  });
  try {
    return {
      version: db.prepare("PRAGMA user_version").get().user_version,
      transactions: db.prepare("SELECT count(*) AS n FROM transactions").get()
        .n,
      token: db
        .prepare("SELECT value FROM settings WHERE key='share_token'")
        .get().value,
      check: db.prepare("PRAGMA quick_check").get().quick_check,
    };
  } finally {
    db.close();
  }
}
function newData(data) {
  const store = openDatabase(data);
  store.run(
    "INSERT INTO transactions(seq,account_id,description,amount_cents,date) VALUES(2,1,'Nouveau',-500,'2026-11-01')",
  );
  store.put("sequence", 2);
  store.db.close();
}
test("failed installation after an actual SQLite migration restores old program AND original data/config, preserving failed copy", async (t) => {
  const f = fixture(t),
    before = inspect(f.data),
    config = fs.readFileSync(path.join(f.data, "private-access.json"), "utf8");
  await assert.rejects(
    install({
      home: f.home,
      release,
      command: () => true,
      probe: async () => false,
      ready: async () => {
        newData(f.data);
        assert.equal(inspect(f.data).version, 3);
        return false;
      },
    }),
    /répond/,
  );
  assert.deepEqual(inspect(f.data), before);
  assert.equal(
    fs.readFileSync(path.join(f.root, "app/marker"), "utf8"),
    "previous program",
  );
  assert.equal(
    fs.readFileSync(path.join(f.data, "private-access.json"), "utf8"),
    config,
  );
  const failed = fs
    .readdirSync(path.join(f.root, "backups"))
    .find((n) => n.startsWith("installation-echouee-"));
  assert.ok(failed);
  assert.equal(
    inspect(path.join(f.root, "backups", failed, "data")).transactions,
    1,
  );
  assert.equal(
    inspect(path.join(f.root, "backups", failed, "data")).version,
    3,
  );
});
test("explicit rollback restores matching previous program/data, saves recent budget and reverses itself if startup fails", async (t) => {
  const f = fixture(t),
    original = inspect(f.data);
  await install({
    home: f.home,
    release,
    command: () => true,
    probe: async () => false,
    ready: async () => {
      newData(f.data);
      return true;
    },
  });
  const recent = inspect(f.data);
  assert.equal(recent.transactions, 1);
  await assert.rejects(
    rollback({ home: f.home, command: () => true }),
    /confirmer/,
  );
  assert.deepEqual(inspect(f.data), recent);
  await assert.rejects(
    rollback({
      home: f.home,
      confirm: true,
      command: () => true,
      ready: async (version) => {
        assert.equal(version, "0.8.0");
        assert.deepEqual(inspect(f.data), original);
        return false;
      },
    }),
    /rétabli/,
  );
  assert.deepEqual(inspect(f.data), recent);
  const result = await rollback({
    home: f.home,
    confirm: true,
    command: () => true,
    ready: async (version) =>
      version === "0.8.0" && inspect(f.data).version === 2,
  });
  assert.deepEqual(inspect(f.data), original);
  assert.deepEqual(inspect(path.join(result.saved, "data")), recent);
  assert.equal(
    fs.readFileSync(path.join(f.root, "app/marker"), "utf8"),
    "previous program",
  );
  await assert.rejects(
    rollback({ home: f.home, confirm: true, command: () => true }),
    /déjà/,
  );
  assert.deepEqual(inspect(f.data), original);
});
