import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { simulate } from "../engine.js";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/available-v010.json", import.meta.url),
    "utf8",
  ),
);
for (const c of fixture.cases)
  test(`0.1.0 spending parity: ${c.frequency}, next paycheck in ${c.offset} days`, () => {
    const result = simulate(c.state, fixture.reference);
    assert.equal(result.available_cents, c.expected.available_cents);
    assert.equal(result.until, c.expected.until);
    assert.deepEqual(result.breakdown, c.expected.breakdown);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.daily.slice(0, 30))),
      c.expected.daily,
    );
  });
