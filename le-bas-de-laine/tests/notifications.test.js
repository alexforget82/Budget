import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {
  createECDH,
  createDecipheriv,
  hkdfSync,
  createPublicKey,
  verify,
  randomBytes,
} from "node:crypto";
import {
  encryptPush,
  generatePushKeys,
  vapidAuthorization,
  validateSubscription,
  validateEndpoint,
  sendWebPush,
} from "../web-push.js";
import {
  createNotifications,
  morningSummary,
  torontoTime,
} from "../notifications.js";
const endpoint = "https://web.push.apple.com/fake-unit-recipient",
  origin = "https://budget.example.ts.net:8443";
function receiver(suffix = "") {
  const dh = createECDH("prime256v1");
  dh.generateKeys();
  const auth = randomBytes(16);
  return {
    dh,
    auth,
    subscription: {
      endpoint: endpoint + suffix,
      keys: {
        p256dh: dh.getPublicKey().toString("base64url"),
        auth: auth.toString("base64url"),
      },
    },
  };
}
function decrypt(body, r) {
  const salt = body.subarray(0, 16),
    len = body[20],
    as = body.subarray(21, 21 + len),
    encrypted = body.subarray(21 + len),
    info = Buffer.concat([
      Buffer.from("WebPush: info\0"),
      r.dh.getPublicKey(),
      as,
    ]),
    ikm = Buffer.from(
      hkdfSync("sha256", r.dh.computeSecret(as), r.auth, info, 32),
    ),
    cek = Buffer.from(
      hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: aes128gcm\0"),
        16,
      ),
    ),
    nonce = Buffer.from(
      hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: nonce\0"),
        12,
      ),
    ),
    decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(encrypted.subarray(-16));
  const raw = Buffer.concat([
    decipher.update(encrypted.subarray(0, -16)),
    decipher.final(),
  ]);
  assert.equal(raw.at(-1), 2);
  return JSON.parse(raw.subarray(0, -1).toString());
}
const state = () => ({
  accounts: [{ id: 1, is_main: 1, kind: "bank" }],
  categories: [
    {
      id: 1,
      name: "Épicerie",
      limit_cents: 10000,
      period: "monthly",
      renewal_day: 1,
      starts_on: "2026-11-01",
      active: 1,
    },
  ],
  transactions: [
    {
      id: 1,
      seq: 2,
      account_id: 1,
      category_id: 1,
      description: "Épicerie",
      amount_cents: -8500,
      date: "2026-11-01",
      included: 0,
      settled_cents: 0,
    },
  ],
  transfers: [],
  checkpoints: [
    { id: 1, seq: 1, account_id: 1, amount_cents: 100000, date: "2026-11-01" },
  ],
  recurrences: [
    {
      id: 1,
      name: "Paie",
      kind: "income",
      amount_cents: 10000,
      frequency: "monthly",
      start_on: "2026-11-02",
      account_id: 1,
      active: 1,
      day_adjust: "none",
    },
  ],
  occurrence_states: [],
});
function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-push-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const data = state(),
    calls = [],
    config = {
      dir,
      state: () => data,
      configured: () => true,
      origin,
      send: async (...args) => {
        calls.push(args);
        return 201;
      },
      ...options,
    };
  const controller = createNotifications(config);
  return { dir, data, calls, config, controller };
}
test("RFC8291 encryption decrypts for receiver, authenticates changes, and ES256 VAPID has correct audience/expiry/contact", () => {
  const r = receiver(),
    payload = { body: "Résumé fictif : 75,00 $", tag: "bdl-test" },
    first = encryptPush(r.subscription, payload),
    second = encryptPush(r.subscription, payload);
  assert.deepEqual(decrypt(first, r), payload);
  assert.notDeepEqual(first, second);
  const tampered = Buffer.from(first);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decrypt(tampered, r));
  const keys = generatePushKeys(),
    now = new Date("2026-11-02T12:00:00Z"),
    header = vapidAuthorization(keys, endpoint, origin, now),
    token = header.match(/^vapid t=([^,]+), k=/)[1],
    parts = token.split("."),
    claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(claims.sub, origin + "/");
  assert.equal(claims.exp, now.getTime() / 1000 + 43200);
  assert.ok(
    verify(
      "sha256",
      Buffer.from(parts[0] + "." + parts[1]),
      {
        key: createPublicKey({ key: keys.private_jwk, format: "jwk" }),
        dsaEncoding: "ieee-p1363",
      },
      Buffer.from(parts[2], "base64url"),
    ),
  );
  assert.throws(
    () => encryptPush(r.subscription, { body: "x".repeat(4000) }),
    /longue/,
  );
});
test("push transport restricts destinations, refuses redirects and sends only encrypted content", async () => {
  for (const bad of [
    "http://web.push.apple.com/x",
    "https://127.0.0.1/x",
    "https://web.push.apple.com.evil.example/x",
    "https://web.push.apple.com:444/x",
    "https://user@web.push.apple.com/x",
    "https://fcm.googleapis.com/x#secret",
  ])
    assert.throws(() => validateEndpoint(bad));
  const r = receiver();
  assert.throws(() =>
    validateSubscription({
      ...r.subscription,
      keys: { ...r.subscription.keys, auth: "bad" },
    }),
  );
  const keys = generatePushKeys(),
    payload = { body: "Confidentiel fictif" };
  let canceled = false;
  const status = await sendWebPush(r.subscription, payload, keys, origin, {
    request: async (url, request) => {
      assert.equal(url, endpoint);
      assert.equal(request.redirect, "error");
      assert.equal(request.headers["Content-Encoding"], "aes128gcm");
      assert.equal(request.headers.TTL, "3600");
      assert.ok(request.headers.Authorization.startsWith("vapid "));
      assert.deepEqual(decrypt(request.body, r), payload);
      assert.ok(!request.body.includes(Buffer.from(payload.body)));
      return {
        status: 201,
        body: {
          cancel: async () => {
            canceled = true;
          },
        },
      };
    },
  });
  assert.equal(status, 201);
  assert.ok(canceled);
});
test("Toronto 7am follows DST, persists one summary per day across restart, never sends at 8am, does not mutate finances", async (t) => {
  assert.equal(torontoTime(new Date("2026-07-02T11:00:00Z")).hour, 7);
  assert.equal(torontoTime(new Date("2026-11-02T12:00:00Z")).hour, 7);
  const f = fixture(t),
    r = receiver();
  f.controller.subscribe({ subscription: r.subscription });
  const before = JSON.stringify(f.data);
  await f.controller.tick(new Date("2026-11-02T11:59:00Z"));
  assert.equal(f.calls.length, 0);
  await f.controller.tick(new Date("2026-11-02T12:00:00Z"));
  assert.equal(f.calls.length, 1);
  assert.ok(!f.calls[0][1].body.includes("100"));
  await f.controller.tick(new Date("2026-11-02T12:10:00Z"));
  assert.equal(f.calls.length, 1);
  const restarted = createNotifications(f.config);
  await restarted.tick(new Date("2026-11-02T12:30:00Z"));
  assert.equal(f.calls.length, 1);
  await restarted.tick(new Date("2026-11-03T13:00:00Z"));
  assert.equal(f.calls.length, 1);
  await restarted.tick(new Date("2026-11-04T12:20:00Z"));
  assert.equal(f.calls.length, 2);
  assert.equal(JSON.stringify(f.data), before);
  assert.equal(
    fs.statSync(path.join(f.dir, "web-push.json")).mode & 0o777,
    0o600,
  );
});
test("detailed summary includes only open planned events, renewals and 80-percent limits; default never leaks numbers or names", () => {
  const data = state(),
    before = JSON.stringify(data),
    hidden = morningSummary(data, "2026-11-01"),
    shown = morningSummary(data, "2026-11-01", true);
  assert.ok(!hidden.body.includes("Épicerie"));
  assert.ok(!/\d/.test(hidden.body));
  assert.ok(shown.body.includes("Épicerie 85 %"));
  assert.ok(shown.body.includes("Renouvellement automatique"));
  data.transactions[0].amount_cents = -8000;
  assert.ok(
    morningSummary(data, "2026-11-01", true).body.includes("Épicerie 80 %"),
  );
  data.transactions[0].amount_cents = -7900;
  assert.ok(
    !morningSummary(data, "2026-11-01", true).body.includes(
      "Limites à surveiller",
    ),
  );
  data.transactions[0].amount_cents = -8500;
  const pay = morningSummary(data, "2026-11-02", true);
  assert.ok(pay.body.includes("100,00"));
  data.occurrence_states.push({
    rule_id: 1,
    original_on: "2026-11-02",
    status: "paid",
  });
  assert.ok(!morningSummary(data, "2026-11-02", true).body.includes("100,00"));
  data.occurrence_states = [];
  assert.equal(JSON.stringify(data), before);
});
test("concurrent ticks and restart of an in-flight reservation never enqueue two daily messages", async (t) => {
  let resolve,
    count = 0;
  const f = fixture(t, {
    send: () => {
      count++;
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  f.controller.subscribe({ subscription: receiver().subscription });
  const pending = f.controller.tick(new Date("2026-11-02T12:00:00Z"));
  await f.controller.tick(new Date("2026-11-02T12:01:00Z"));
  assert.equal(count, 1);
  const other = createNotifications(f.config);
  await other.tick(new Date("2026-11-02T12:01:00Z"));
  assert.equal(count, 1);
  resolve(201);
  await pending;
});
test("known errors retry at most three times in the morning; expired endpoints disable; paused/deleted and changed-origin recipients stop", async (t) => {
  let code = 503;
  const f = fixture(t, { send: async () => code }),
    r = receiver();
  f.controller.subscribe({ subscription: r.subscription });
  for (const minute of [0, 1, 5, 10, 20])
    await f.controller.tick(
      new Date(`2026-11-02T12:${String(minute).padStart(2, "0")}:00Z`),
    );
  let config = JSON.parse(fs.readFileSync(path.join(f.dir, "web-push.json")));
  assert.equal(config.devices[0].attempts, 3);
  code = 410;
  await f.controller.tick(new Date("2026-11-03T12:00:00Z"));
  assert.equal(
    f.controller.status(r.subscription.endpoint).device.enabled,
    false,
  );
  assert.equal(
    f.controller.status(r.subscription.endpoint).device.last_status,
    "expired",
  );
  f.controller.subscribe({ subscription: r.subscription });
  f.controller.disableAll();
  assert.equal(f.controller.status().devices_count, 0);
  f.controller.unsubscribe({ endpoint: r.subscription.endpoint });
  assert.equal(f.controller.status(r.subscription.endpoint).device, null);
  f.controller.subscribe({ subscription: r.subscription });
  let unexpected = 0;
  const blockedSend = async () => {
    unexpected++;
    return 201;
  };
  const changed = createNotifications({
    ...f.config,
    origin: "https://other.example.ts.net:8443",
    send: blockedSend,
  });
  const changedOwner = createNotifications({
    ...f.config,
    owner: "other-owner",
    send: blockedSend,
  });
  assert.equal(changed.status().devices_count, 0);
  assert.equal(changedOwner.status().devices_count, 0);
  await changed.tick(new Date("2026-11-04T12:00:00Z"));
  await changedOwner.tick(new Date("2026-11-04T12:00:00Z"));
  assert.equal(unexpected, 0);
});
test("corrupt local notification configuration cannot change or block the budget, and keys are never returned by public status", async (t) => {
  const f = fixture(t);
  f.controller.subscribe({ subscription: receiver().subscription });
  const serialized = JSON.stringify(f.controller.status());
  assert.ok(!serialized.includes("private_jwk"));
  assert.ok(!serialized.includes("endpoint"));
  assert.ok(!serialized.includes("p256dh"));
  const file = path.join(f.dir, "web-push.json");
  fs.writeFileSync(file, "corrupt");
  const broken = createNotifications(f.config);
  assert.ok(broken.status().error);
  assert.throws(() => broken.prepare(), /illisible/);
  await broken.tick(new Date("2026-11-02T12:00:00Z"));
  assert.equal(fs.readFileSync(file, "utf8"), "corrupt");
});
test("service worker displays push without fetching finances and notification clicks open only the local full dashboard", async () => {
  const handlers = {},
    shown = [],
    opened = [],
    self = {
      location: { origin },
      registration: { showNotification: async (...x) => shown.push(x) },
      clients: {
        claim: async () => {},
        matchAll: async () => [],
        openWindow: async (url) => opened.push(url),
      },
      addEventListener: (type, fn) => (handlers[type] = fn),
      skipWaiting: () => {},
    };
  vm.runInNewContext(
    fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    { self, URL },
  );
  let promise;
  handlers.push({
    data: {
      json: () => ({
        body: "Résumé",
        tag: "bdl-test",
        url: "https://evil.example",
      }),
    },
    waitUntil: (p) => (promise = p),
  });
  await promise;
  assert.equal(shown[0][0], "Le bas de laine");
  assert.equal(shown[0][1].renotify, false);
  assert.equal(shown[0][1].data.url, "/#today");
  handlers.notificationclick({
    notification: { close: () => {} },
    waitUntil: (p) => (promise = p),
  });
  await promise;
  assert.equal(opened.length, 1);
  const target = new URL(opened[0]);
  assert.equal(target.origin, origin);
  assert.equal(target.pathname, "/");
  assert.equal(target.hash, "#today");
  assert.match(target.searchParams.get("rappel"), /^\d+$/);
  assert.equal(handlers.fetch, undefined);
});
