import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "./database-migrations.js";
export function openBudgetDatabase(dir, today) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dir, "budget.sqlite"));
  try {
    migrateDatabase(db, { dataDir: dir, today });
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
  } catch (e) {
    db.close();
    throw e;
  }
  const q = (sql, ...args) => db.prepare(sql).all(...args),
    run = (sql, ...args) => db.prepare(sql).run(...args);
  function atomic(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return { db, q, run, atomic };
}
