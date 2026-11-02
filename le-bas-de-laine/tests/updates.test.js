import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createUpdateChecker,
  newerVersion,
  releaseURL,
  validateRelease,
  UPDATE_SOURCE,
} from "../updates.js";
const manifest = {
  version: "1.2.0",
  url: releaseURL("1.2.0"),
  sha256: "a".repeat(64),
  notes: "Version fictive.",
};
function dir(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-update-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}
test("release comparison is numeric and release metadata cannot inject a URL or shell version", () => {
  assert.ok(newerVersion("1.10.0", "1.2.0"));
  assert.ok(!newerVersion("1.2.0", "1.2.0"));
  assert.ok(!newerVersion("0.9.9", "1.0.0"));
  assert.deepEqual(validateRelease(manifest), manifest);
  for (const v of ["1.2.0;bad", "1.2.0-rc", "01.2.0"])
    assert.throws(() => releaseURL(v));
  assert.throws(() =>
    validateRelease({ ...manifest, url: "https://evil.example/download" }),
  );
  assert.throws(() => validateRelease({ ...manifest, sha256: "wrong" }));
});
test("checks use only fixed public metadata, cache for a day, serialize concurrent requests and survive restart", async (t) => {
  let calls = 0,
    now = new Date("2026-11-02T12:00:00Z");
  const d = dir(t),
    request = async (url, options) => {
      calls++;
      assert.equal(url, UPDATE_SOURCE);
      assert.equal(options.redirect, "error");
      assert.equal(options.body, undefined);
      return new Response(JSON.stringify(manifest));
    };
  const checker = createUpdateChecker({
    dir: d,
    version: "1.1.0",
    clock: () => now,
    request,
  });
  const [a, b] = await Promise.all([checker.check(), checker.check()]);
  assert.ok(a.available);
  assert.ok(b.available);
  assert.equal(calls, 1);
  await checker.check();
  assert.equal(calls, 1);
  const next = createUpdateChecker({
    dir: d,
    version: "1.2.0",
    clock: () => now,
    request,
  });
  assert.equal(next.status().available, false);
  await next.check();
  assert.equal(calls, 1);
  now = new Date("2026-11-03T12:01:00Z");
  await next.check();
  assert.equal(calls, 2);
});
test("offline/oversized/invalid metadata never removes a known release or claims success; auto checking can be disabled", async (t) => {
  const d = dir(t);
  let fail = false;
  const checker = createUpdateChecker({
    dir: d,
    version: "1.1.0",
    request: async () => {
      if (fail) throw Error("offline");
      return new Response(JSON.stringify(manifest));
    },
  });
  await checker.check({ force: true });
  fail = true;
  const status = await checker.check({ force: true });
  assert.ok(status.error);
  assert.ok(status.available);
  assert.equal(status.latest.version, "1.2.0");
  checker.preferences({ automatic: false });
  const previous = checker.status().last_checked_at;
  await checker.check();
  assert.equal(checker.status().last_checked_at, previous);
  for (const body of [
    "x".repeat(17000),
    JSON.stringify({ ...manifest, url: "https://evil.example" }),
  ]) {
    const other = createUpdateChecker({
      dir: dir(t),
      version: "1.2.0",
      request: async () => new Response(body),
    });
    assert.ok((await other.check({ force: true })).error);
    assert.equal(other.status().latest, null);
  }
});
