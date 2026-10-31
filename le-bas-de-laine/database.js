import {
  calendarStateChanges,
  applyCalendarStateChanges,
} from "./calendar-state.js";
import { validateState } from "./validation.js";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
export function openDatabase(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filename = path.join(dir, "budget.sqlite"),
    db = new DatabaseSync(filename);
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 1) throw Error("Cette base exige une version plus récente.");
  if (version === 0) {
    if (
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .get()
    )
      throw Error("Base inconnue : aucune modification.");
    db.exec(
      fs.readFileSync(
        new URL("./migrations/001-initial.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  if (version === 1) {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => r.name)
      .sort();
    if (
      names.join() !==
      [
        "accounts",
        "categories",
        "transactions",
        "transfers",
        "recurrences",
        "occurrence_states",
        "checkpoints",
        "settings",
      ]
        .sort()
        .join()
    )
      throw Error(
        "Cette base n’est pas une base du Bas de laine. Aucun changement.",
      );
  }
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000",
  );
  const q = (sql, ...args) => db.prepare(sql).all(...args),
    run = (sql, ...args) => db.prepare(sql).run(...args);
  const atomic = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      db.exec("COMMIT");
      return v;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const setting = (key, fallback = null) => {
    const row = q("SELECT value FROM settings WHERE key=?", key)[0];
    return row ? JSON.parse(row.value) : fallback;
  };
  const put = (key, value) =>
    run(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      JSON.stringify(value),
    );
  const sequence = () => {
    const n = setting("sequence", 0) + 1;
    put("sequence", n);
    return n;
  };
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
  const state = () => ({
    ...Object.fromEntries(
      tables
        .filter((t) => t !== "settings")
        .map((t) => [t, q("SELECT * FROM " + t)]),
    ),
    card_baseline_seq: setting("card_baseline_seq", 0),
    fallback_category_id: setting("fallback_category_id", null),
  });
  const backup = (name) => {
    const folder = path.join(dir, "backups");
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const target = path.join(folder, name + ".sqlite");
    if (!fs.existsSync(target)) {
      db.prepare("VACUUM INTO ?").run(target);
      fs.chmodSync(target, 0o600);
    }
    return target;
  };
  const daily = (date) => backup("quotidienne-" + date);
  function reconcileCalendar() {
    if (setting("payment_calendar_version") === "canada-2026-2027-v1") return;
    const changes = calendarStateChanges(state());
    if (changes.length) backup("avant-calendrier-canadien-" + Date.now());
    atomic(() => {
      applyCalendarStateChanges({ run }, changes);
      put("payment_calendar_version", "canada-2026-2027-v1");
    });
  }
  const exportData = () => ({
    format: "le-bas-de-laine",
    version: 1,
    created_at: new Date().toISOString(),
    tables: Object.fromEntries(tables.map((t) => [t, q("SELECT * FROM " + t)])),
  });
  function restore(payload) {
    if (
      payload?.format !== "le-bas-de-laine" ||
      payload.version !== 1 ||
      !payload.tables ||
      Object.keys(payload.tables).sort().join() !== [...tables].sort().join()
    )
      throw Error("Sauvegarde incompatible.");
    const stage = openDatabase(path.join(dir, ".validation-" + Date.now()));
    try {
      stage.db.exec("PRAGMA foreign_keys=OFF");
      stage.atomic(() => {
        for (const table of [...tables].reverse())
          stage.run("DELETE FROM " + table);
        for (const table of tables) {
          if (
            !Array.isArray(payload.tables[table]) ||
            payload.tables[table].length > 200000
          )
            throw Error("Table invalide.");
          const columns = stage
            .q("PRAGMA table_info(" + table + ")")
            .map((c) => c.name);
          for (const row of payload.tables[table]) {
            if (
              !row ||
              Object.keys(row).sort().join() !== [...columns].sort().join()
            )
              throw Error("Colonnes de sauvegarde invalides.");
            stage.run(
              "INSERT INTO " +
                table +
                "(" +
                columns.join() +
                ") VALUES(" +
                columns.map(() => "?").join() +
                ")",
              ...columns.map((k) => row[k]),
            );
          }
        }
        if (stage.q("PRAGMA foreign_key_check").length)
          throw Error("Liens invalides.");
      });
      validateState(stage.state());
      stage.reconcileCalendar();
      const max = Math.max(
        0,
        ...stage.state().transactions.map((t) => t.seq),
        ...stage.state().transfers.map((t) => t.seq),
        ...stage.state().checkpoints.map((t) => t.seq),
      );
      if (
        !Number.isSafeInteger(stage.setting("sequence")) ||
        stage.setting("sequence") < max
      )
        throw Error("Ordre de saisie invalide.");
      backup("avant-restauration-" + Date.now());
      db.exec("PRAGMA foreign_keys=OFF");
      try {
        atomic(() => {
          for (const table of [...tables].reverse())
            run("DELETE FROM " + table);
          for (const table of tables) {
            const columns = q("PRAGMA table_info(" + table + ")").map(
              (c) => c.name,
            );
            for (const row of stage.q("SELECT * FROM " + table))
              run(
                "INSERT INTO " +
                  table +
                  "(" +
                  columns.join() +
                  ") VALUES(" +
                  columns.map(() => "?").join() +
                  ")",
                ...columns.map((k) => row[k]),
              );
          }
        });
      } finally {
        db.exec("PRAGMA foreign_keys=ON");
      }
    } finally {
      stage.db.close();
      fs.rmSync(path.dirname(stage.filename), { recursive: true, force: true });
    }
  }
  reconcileCalendar();
  return {
    reconcileCalendar,
    db,
    filename,
    dir,
    q,
    run,
    atomic,
    setting,
    put,
    sequence,
    state,
    tables,
    backup,
    daily,
    exportData,
    restore,
  };
}
