import test from "node:test";
import assert from "node:assert/strict";
import {
  occurrenceInfo,
  nextOccurrence,
  holidaySet,
  shiftDate,
} from "../calendar.js";
import { occurrences } from "../dates.js";
test("weekends can keep the date, advance or postpone without changing the recurrence anchor", () => {
  for (const [mode, expected] of [
    ["none", "2026-08-01"],
    ["before", "2026-07-31"],
    ["after", "2026-08-03"],
  ])
    assert.equal(
      occurrenceInfo("2026-08-01", "weekly", 0, mode).date,
      expected,
    );
  assert.equal(
    occurrenceInfo("2026-08-01", "weekly", 1, "before").date,
    "2026-08-07",
  );
  assert.equal(
    occurrenceInfo("2026-08-01", "weekly", 0, "before").nominal,
    "2026-08-01",
  );
});
test("Quebec and federal bank holidays include Christmas/Boxing substitutes and cross-year moves", () => {
  assert.equal(shiftDate("2026-06-24", "before"), "2026-06-23");
  assert.equal(shiftDate("2026-06-24", "after"), "2026-06-25");
  assert.equal(shiftDate("2026-07-01", "before"), "2026-06-30");
  assert.equal(shiftDate("2027-01-01", "before"), "2026-12-31");
  assert.equal(shiftDate("2027-01-01", "after"), "2027-01-04");
  const holidays = holidaySet(2027);
  assert.ok(holidays.has("2027-12-27"));
  assert.ok(holidays.has("2027-12-28"));
  assert.equal(shiftDate("2027-12-25", "after"), "2027-12-29");
  assert.equal(shiftDate("2027-12-25", "before"), "2027-12-24");
  assert.equal(shiftDate("2027-09-30", "after"), "2027-10-01");
});
test("calendar month end differs from last business day and includes leap February", () => {
  assert.equal(occurrenceInfo("2027-01-12", "last_day", 0).date, "2027-01-31");
  assert.equal(
    occurrenceInfo("2027-01-12", "last_business_day", 0).date,
    "2027-01-29",
  );
  assert.equal(
    occurrenceInfo("2027-01-12", "last_day", 0, "after").date,
    "2027-02-01",
  );
  assert.equal(occurrenceInfo("2027-01-12", "last_day", 1).date, "2027-02-28");
  assert.equal(occurrenceInfo("2028-01-12", "last_day", 1).date, "2028-02-29");
  assert.equal(nextOccurrence("2027-01-12", "last_day", 2), "2027-03-31");
});
test("month, quarter, half-year and year stay anchored after a short month or a shifted date", () => {
  assert.equal(occurrenceInfo("2028-01-31", "monthly", 1).date, "2028-02-29");
  assert.equal(occurrenceInfo("2028-01-31", "monthly", 2).date, "2028-03-31");
  assert.equal(occurrenceInfo("2028-01-31", "quarterly", 1).date, "2028-04-30");
  assert.equal(
    occurrenceInfo("2028-01-31", "semiannual", 1).date,
    "2028-07-31",
  );
  assert.equal(occurrenceInfo("2028-02-29", "yearly", 1).date, "2029-02-28");
});
test("a shifted occurrence across a month boundary exists once, in its effective date window", () => {
  const rule = {
    id: 1,
    name: "Fin du mois",
    kind: "expense",
    start_on: "2027-01-01",
    frequency: "last_day",
    day_adjust: "after",
  };
  assert.equal(occurrences(rule, "2027-01-01", "2027-01-31").length, 0);
  const rows = occurrences(rule, "2027-02-01", "2027-03-01");
  assert.deepEqual(
    rows.map((r) => r.date),
    ["2027-02-01", "2027-03-01"],
  );
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
});
test("invalid adjustments fail rather than silently reverting to unchanged dates", () => {
  assert.throws(() => shiftDate("2026-08-01", "bad"));
  assert.equal(shiftDate("2026-08-01", "previous"), "2026-07-31");
});
test("a biweekly holiday advance never changes the original two-week cadence", () => {
  assert.equal(
    occurrenceInfo("2026-12-25", "biweekly", 0, "before").date,
    "2026-12-24",
  );
  assert.equal(
    occurrenceInfo("2026-12-25", "biweekly", 1, "before").date,
    "2027-01-08",
  );
});

test("Good Friday is skipped in either direction", () => {
  assert.equal(shiftDate("2027-03-26", "before"), "2027-03-25");
  assert.equal(shiftDate("2027-03-26", "after"), "2027-03-29");
});
test("dates match the separate Sillage calendar on shared supported rules", async (t) => {
  const fs = await import("node:fs");
  const { pathToFileURL } = await import("node:url");
  const path = await import("node:path");
  const file = path.resolve(
    import.meta.dirname,
    "../../recurrence-calendar.js",
  );
  if (!fs.existsSync(file)) {
    t.skip("External Sillage reference program is not bundled.");
    return;
  }
  const old = await import(pathToFileURL(file).href);
  for (const start of [
    "2026-11-14",
    "2026-11-15",
    "2027-03-26",
    "2027-12-25",
    "2027-12-26",
    "2027-01-31",
    "2028-01-31",
    "2028-02-29",
  ])
    for (const frequency of [
      "weekly",
      "biweekly",
      "monthly",
      "last_business_day",
    ])
      for (const mode of ["none", "before", "after"])
        for (let i = 0; i < 12; i++)
          assert.deepEqual(
            occurrenceInfo(start, frequency, i, mode),
            old.occurrenceInfo(start, frequency, i, mode),
          );
  for (let year = 2026; year <= 2030; year++)
    assert.deepEqual(
      [...holidaySet(year)].sort(),
      [...old.holidaySet(year)].sort(),
    );
});
