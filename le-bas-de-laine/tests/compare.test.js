import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { compareBackup, compareForecasts } from "../compare.js";
import { today, addDays } from "../dates.js";
const source = path.resolve(import.meta.dirname, "../..");
test(
  "local comparison against real isolated Sillage matches all 30 days on the canonical grocery example",
  { skip: !fs.existsSync(path.join(source, "server.js")) },
  async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-legacy-test-")),
      probe = net.createServer();
    await new Promise((r) => probe.listen(0, "127.0.0.1", r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    const child = spawn(process.execPath, [path.join(source, "server.js")], {
      cwd: dir,
      env: { ...process.env, PORT: String(port), TZ: "America/Toronto" },
      stdio: ["ignore", "ignore", "ignore"],
    });
    t.after(async () => {
      if (child.exitCode === null) {
        const stopped = once(child, "exit");
        child.kill();
        await stopped;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    });
    const base = "http://127.0.0.1:" + port;
    const call = async (url, data) => {
      const r = await fetch(
        base + url,
        data
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          : {},
      );
      const b = await r.json();
      assert.equal(r.status, 200, JSON.stringify(b));
      return b;
    };
    for (let i = 0; i < 80; i++) {
      try {
        await call("/api/state");
        break;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    let s = await call("/api/accounts", {
      name: "Conjoint fictif",
      kind: "checking",
      balance: 1000,
    });
    const bank = s.accounts[0].id;
    s = await call("/api/accounts", {
      name: "Carte fictive",
      kind: "credit",
      balance: 0,
    });
    const card = s.accounts[0].id;
    s = await call("/api/categories", { name: "Épicerie fictive" });
    const category = s.categories.find((c) => c.name === "Épicerie fictive").id;
    s = await call("/api/envelopes", {
      name: "Épicerie fictive",
      reserved: 0,
      budget: 230,
      frequency: "weekly",
      start_on: today(),
      forecast_spend: false,
      rollover: false,
    });
    const envelope = s.envelopes[0].id;
    await call("/api/recurring", {
      description: "Paie fictive",
      type: "income",
      amount: 1000,
      account_id: bank,
      start_on: addDays(today(), 1),
      frequency: "biweekly",
    });
    s = await call("/api/transactions", {
      account_id: card,
      category_id: category,
      envelope_id: envelope,
      description: "Épicerie fictive",
      amount: -71.69,
      happened_on: today(),
    });
    assert.equal(s.safe_cents, 77000);
    const backup = await call("/api/backup/export"),
      sourceBytes = fs.readFileSync(path.join(dir, "data/budget.sqlite")),
      report = await compareBackup(backup, {
        reference: today(),
        sillageDir: source,
      });
    assert.equal(report.horizon, 30);
    assert.equal(
      report.unclassified,
      0,
      JSON.stringify(report.differences.slice(0, 4)),
    );
    assert.equal(report.validated, true);
    assert.equal(report.indicators.available.bas_de_laine_cents, 77000);
    assert.deepEqual(
      fs.readFileSync(path.join(dir, "data/budget.sqlite")),
      sourceBytes,
    );
  },
);
test("comparison never invents fault attribution and requires an explanation for every classification", () => {
  const old = {
      safe_cents: 10000,
      forecast: [
        {
          date: "2026-10-22",
          cash_cents: 10000,
          safe_cents: 10000,
          envelope_reserved_cents: 0,
          card_envelope_reserved_cents: 0,
          events: [],
        },
      ],
    },
    next = {
      until: "2026-10-22",
      available_cents: 9000,
      minimum_cents: 9000,
      daily: [
        {
          date: "2026-10-22",
          cash_cents: 10000,
          safe_cents: 9000,
          limits_cents: 1000,
          card_cents: 0,
          events: [],
        },
      ],
    };
  let r = compareForecasts(old, next);
  assert.equal(r.validated, false);
  assert.ok(r.differences.every((d) => d.classification === null));
  const decisions = Object.fromEntries(
    r.differences.map((d) => [
      d.key,
      {
        classification: "règle volontairement différente",
        explanation: "Cette limite de catégorie est un ajout intentionnel.",
      },
    ]),
  );
  assert.equal(compareForecasts(old, next, decisions).validated, true);
  decisions[r.differences[0].key].explanation = "";
  assert.throws(() => compareForecasts(old, next, decisions));
});
