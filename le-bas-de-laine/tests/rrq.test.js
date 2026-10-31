import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { occurrenceInfo, nextOccurrence } from "../calendar.js";
import { simulate } from "../engine.js";
import { openDatabase } from "../database.js";
import { createService } from "../service.js";
import { nationalOccurrenceDate } from "../calendar-state.js";
test("RRQ uses supplied November and December 2026 dates, without changing other month-end rules", () => {
  assert.equal(
    occurrenceInfo("2026-11-01", "rrq", 0, "before").date,
    "2026-11-30",
  );
  assert.equal(
    occurrenceInfo("2026-11-01", "rrq", 1, "before").date,
    "2026-12-30",
  );
  assert.equal(nextOccurrence("2026-12-01", "rrq", 0), "2026-12-30");
  assert.equal(occurrenceInfo("2026-12-01", "rrq", 0).estimated, false);
  assert.equal(
    occurrenceInfo("2026-12-01", "last_business_day", 0).date,
    "2026-12-31",
  );
  assert.equal(
    occurrenceInfo("2026-12-01", "rrq", 0, "none", false, true).date,
    "2026-12-31",
  );
  assert.equal(
    nationalOccurrenceDate(
      { start_on: "2026-11-01", frequency: "rrq", day_adjust: "before" },
      "2026-12-31",
    ),
    "2026-12-30",
  );
});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-rrq-"));
  let store = openDatabase(dir);
  t.after(() => {
    try {
      store.db.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const api = createService(store, () => "2026-11-01");
  store.atomic(() =>
    api.setup({
      balance: 1000,
      paychecks: [
        {
          name: "Rente RRQ",
          amount: 1200,
          start_on: "2026-11-01",
          frequency: "rrq",
          day_adjust: "before",
        },
      ],
    }),
  );
  return {
    store,
    api,
    dir,
    reopen: () => {
      store.db.close();
      store = openDatabase(dir);
      return store;
    },
  };
}
test("preview flags only the unprovided month as an estimate; forecast has one December deposit on the 30th", (t) => {
  const { store, api } = fixture(t),
    rule = store.state().recurrences[0];
  const out = api.previewRecurrence({ ...rule });
  assert.deepEqual(
    out.dates.map((d) => [d.date, d.estimated]),
    [
      ["2026-11-30", false],
      ["2026-12-30", false],
      ["2027-01-29", true],
    ],
  );
  assert.equal(out.estimated, true);
  const sim = simulate(store.state(), "2026-12-01", 31);
  const deposits = sim.daily
    .flatMap((d) => d.events)
    .filter((e) => e.kind === "income");
  assert.equal(deposits.length, 1);
  assert.equal(deposits[0].date, "2026-12-30");
  assert.equal(
    sim.daily.find((d) => d.date === "2026-12-29").cash_cents,
    100000,
  );
  assert.equal(
    sim.daily.find((d) => d.date === "2026-12-30").cash_cents,
    220000,
  );
  assert.equal(
    sim.daily.find((d) => d.date === "2026-12-31").cash_cents,
    220000,
  );
  assert.equal(
    sim.warnings.some((w) => w.includes("RRQ")),
    false,
  );
  assert.equal(
    simulate(store.state(), "2027-01-01", 31).warnings.some((w) =>
      w.includes("RRQ"),
    ),
    true,
  );
});
test("RRQ correction preserves an already received December payment on an existing 0.4.5 database", (t) => {
  const f = fixture(t),
    r = f.store.state().recurrences[0];
  const received = createService(f.store, () => "2026-12-29");
  f.store.atomic(() => {
    const id = received.transaction({
      account_id: r.account_id,
      amount: 1200,
      description: "Rente reçue",
      date: "2026-12-29",
    });
    f.store.run(
      "INSERT INTO occurrence_states(rule_id,original_on,status,transaction_id) VALUES(?,?,'paid',?)",
      r.id,
      "2026-12-31",
      id,
    );
    f.store.put("payment_calendar_version", "canada-2026-2027-v1");
  });
  const original = JSON.stringify(f.store.state().transactions),
    store = f.reopen();
  assert.equal(store.state().occurrence_states[0].original_on, "2026-12-30");
  assert.equal(JSON.stringify(store.state().transactions), original);
  assert.equal(
    simulate(store.state(), "2026-12-29", 3)
      .daily.flatMap((d) => d.events)
      .some((e) => e.rule_id === r.id),
    false,
  );
  assert.equal(
    fs
      .readdirSync(path.join(f.dir, "backups"))
      .filter((n) => n.startsWith("avant-calendrier-canadien-")).length,
    1,
  );
  store.reconcileCalendar();
  assert.equal(store.state().occurrence_states.length, 1);
});
