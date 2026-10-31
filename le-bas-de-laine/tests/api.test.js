import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { today, addDays } from "../dates.js";
const root = path.resolve(import.meta.dirname, "..");
export async function launch(t, privateAccess = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-http-"));
  if (privateAccess)
    fs.writeFileSync(
      path.join(dir, "private-access.json"),
      JSON.stringify({
        origin: "https://budget.example.ts.net:8443",
        login: "owner@example.com",
      }),
    );
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const child = spawn(process.execPath, [path.join(root, "server.js")], {
    env: { ...process.env, BDL_DATA: dir, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stderr.on("data", (b) => (log += b));
  const base = "http://127.0.0.1:" + port;
  t.after(async () => {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3000).unref();
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/state")).ok) break;
    } catch {}
    if (child.exitCode !== null) throw Error(log);
    await new Promise((r) => setTimeout(r, 50));
  }
  const call = async (url, data, status = 200, headers = {}) => {
    const response = await fetch(base + url, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  };
  return { base, dir, call, child };
}
async function setup(f) {
  return f.call("/api/setup", {
    balance: 1000,
    paychecks: [
      {
        name: "Paie",
        amount: 1000,
        frequency: "biweekly",
        start_on: addDays(today(), 1),
      },
    ],
    categories: [
      {
        name: "Épicerie",
        limit: 230,
        period: "weekly",
        renewal_day: new Date(today() + "T12:00:00Z").getUTCDay(),
      },
    ],
  });
}
test("HTTP setup, card purchase, payment, checkpoint and exact readonly shared values", async (t) => {
  const f = await launch(t);
  let s = await setup(f);
  assert.equal(s.simulation.available_cents, 77000);
  s = await f.call("/api/account", { name: "Carte CIBC" });
  const card = s.accounts.find((a) => a.kind === "card").id,
    bank = s.accounts.find((a) => a.is_main).id,
    cat = s.categories[0].id;
  s = await f.call("/api/transaction", {
    account_id: card,
    category_id: cat,
    description: "Épicerie",
    amount: -71.69,
    date: today(),
  });
  assert.equal(s.simulation.available_cents, 77000);
  s = await f.call("/api/transfer", {
    from_account_id: bank,
    to_account_id: card,
    amount: 20,
    date: today(),
    description: "Paiement",
  });
  assert.equal(s.simulation.bank_cents, 98000);
  assert.equal(s.simulation.card_cents, 5169);
  assert.equal(s.simulation.available_cents, 77000);
  s = await f.call("/api/checkpoint", { account_id: bank, amount: 980 });
  assert.equal(s.simulation.card_cents, 5169);
  const share = await f.call("/api/share", { action: "create" }),
    shared = await f.call(share.result.path + "/data");
  assert.deepEqual(shared.simulation, s.simulation);
  assert.equal(shared.accounts, undefined);
  assert.equal(shared.transactions, undefined);
  const manifest = await f.call(share.result.path + "/manifest.webmanifest");
  assert.equal(manifest.start_url, share.result.path);
  assert.equal(manifest.scope, share.result.path);
  await f.call(share.result.path + "/data", { amount: 1 }, 404);
  await f.call("/api/share", { action: "revoke" });
  await f.call(share.result.path + "/data", undefined, 404);
});
test("CSV separates bank history/category usage and requires an explicit matching choice", async (t) => {
  const f = await launch(t),
    s = await setup(f),
    bank = s.accounts[0].id,
    cat = s.categories[0].id;
  const csv = "Date;Description;Montant\n" + today() + ";Épicerie;-71,69",
    options = {
      account_id: bank,
      category_id: cat,
      included: true,
      date_format: "ISO",
    };
  let p = await f.call("/api/csv/preview", { csv, options });
  assert.equal(p.rows[0].amount_cents, -7169);
  const after = await f.call("/api/csv/apply", {
    csv,
    options,
    token: p.token,
    selected: [{ row: 0 }],
  });
  assert.equal(after.simulation.bank_cents, 100000);
  assert.equal(after.simulation.categories[0].current.remaining_cents, 15831);
  p = await f.call("/api/csv/preview", { csv, options });
  assert.equal(p.rows[0].duplicate, true);
  const rule = await f.call("/api/recurrence", {
      name: "Hydro",
      kind: "expense",
      amount: 90,
      account_id: bank,
      start_on: today(),
      frequency: "monthly",
    }),
    bill = rule.simulation.upcoming.find((o) => o.name === "Hydro");
  const text = "Date,Description,Montant\n" + today() + ",Hydro,-90.00";
  p = await f.call("/api/csv/preview", {
    csv: text,
    options: { account_id: bank, included: false },
  });
  assert.equal(p.rows[0].matches[0].rule_id, bill.rule_id);
  const paid = await f.call("/api/csv/apply", {
    csv: text,
    options: { account_id: bank, included: false },
    token: p.token,
    selected: [{ row: 0, occurrence: p.rows[0].matches[0] }],
  });
  assert.equal(paid.transactions.length, 2);
  assert.equal(
    paid.simulation.upcoming.filter(
      (o) => o.name === "Hydro" && o.original_on === today(),
    ).length,
    0,
  );
});
test("stale previews, duplicate selected rows and invalid money never partially apply", async (t) => {
  const f = await launch(t),
    s = await setup(f),
    options = { account_id: s.accounts[0].id, included: false },
    csv = "Date,Description,Montant\n" + today() + ",Marché,-10.00";
  const p = await f.call("/api/csv/preview", { csv, options });
  await f.call(
    "/api/csv/apply",
    { csv, options, token: p.token, selected: [{ row: 0 }, { row: 0 }] },
    400,
  );
  assert.equal((await f.call("/api/state")).transactions.length, 0);
  await f.call("/api/transaction", {
    account_id: options.account_id,
    description: "Autre",
    amount: -1,
    date: today(),
  });
  await f.call(
    "/api/csv/apply",
    { csv, options, token: p.token, selected: [{ row: 0 }] },
    400,
  );
  await f.call(
    "/api/transaction",
    {
      account_id: options.account_id,
      description: "Trop précis",
      amount: "1.005",
      date: today(),
    },
    400,
  );
});
test("host/origin/content type checks and static maquettes expose no budget data", async (t) => {
  const f = await launch(t);
  assert.equal(
    await new Promise((resolve) => {
      http.get(
        f.base + "/api/state",
        { headers: { Host: "evil.example" } },
        (r) => {
          r.resume();
          resolve(r.statusCode);
        },
      );
    }),
    403,
  );
  await f.call("/api/setup", { balance: 1 }, 403, {
    Origin: "https://evil.example",
  });
  await f.call("/api/setup", { balance: 1 }, 403, {
    "Content-Type": "text/plain",
  });
  const html = await fetch(f.base + "/maquettes");
  assert.equal(html.status, 200);
  assert.ok((await html.text()).includes("Données fictives"));
  const demo = await (await fetch(f.base + "/demo.json")).json();
  assert.equal(demo.simulation.daily.length, 90);
  assert.ok(demo.simulation.available_cents > 0);
  const traversal = await fetch(f.base + "/%2e%2e/package.json");
  assert.equal(traversal.status, 404);
});
test("private access enforces Tailscale identity; wife token remains readonly", async (t) => {
  const f = await launch(t, true);
  await setup(f);
  const share = (await f.call("/api/share", { action: "create" })).result.path;
  const raw = (url, login) =>
    new Promise((resolve, reject) => {
      http
        .get(
          "http://127.0.0.1:3041" + url,
          {
            headers: {
              Host: "budget.example.ts.net:8443",
              ...(login ? { "Tailscale-User-Login": login } : {}),
            },
          },
          (r) => {
            let text = "";
            r.on("data", (b) => (text += b));
            r.on("end", () => resolve({ status: r.statusCode, text }));
          },
        )
        .on("error", reject);
    });
  assert.equal((await raw("/api/state")).status, 403);
  assert.equal((await raw("/api/state", "wife@example.com")).status, 403);
  assert.equal((await raw("/api/state", "owner@example.com")).status, 200);
  assert.equal((await raw(share + "/data", "wife@example.com")).status, 200);
  assert.equal((await raw("/styles.css", "wife@example.com")).status, 200);
  assert.equal((await raw("/api/export", "wife@example.com")).status, 403);
});
test("trial reset requires exact confirmation, preserves a backup and clears only its own eight tables", async (t) => {
  const f = await launch(t);
  await setup(f);
  const before = await f.call("/api/export");
  await f.call("/api/reset", { confirm: "oui" }, 400);
  assert.deepEqual((await f.call("/api/export")).tables, before.tables);
  const reset = await f.call("/api/reset", { confirm: "EFFACER" });
  assert.equal(reset.configured, false);
  assert.equal(reset.accounts.length, 0);
  assert.ok(
    fs
      .readdirSync(path.join(f.dir, "backups"))
      .some((n) => n.startsWith("avant-reinitialisation")),
  );
  await f.call("/api/restore", { backup: before, confirm: "REMPLACER" });
  assert.deepEqual((await f.call("/api/export")).tables, before.tables);
});

test("readonly purchase preview uses limits and does not debit or create anything; savings excluded", async (t) => {
  const f = await launch(t);
  let state = await f.call("/api/setup", {
    balance: 1000,
    paychecks: [
      {
        name: "Paie",
        amount: 1000,
        frequency: "weekly",
        start_on: addDays(today(), 1),
        day_adjust: "none",
      },
    ],
    categories: [
      {
        name: "Épicerie",
        limit: 230,
        period: "weekly",
        renewal_day: new Date(today() + "T12:00:00Z").getUTCDay(),
      },
    ],
  });
  const bank = state.accounts[0].id,
    cat = state.categories[0].id;
  state = await f.call("/api/account", { name: "Carte" });
  const card = state.accounts.find((a) => a.kind === "card").id;
  const initial = await f.call("/api/export");
  const a = await f.call("/api/purchase/preview", {
    amount: 71.69,
    date: today(),
    account_id: card,
    category_id: cat,
  });
  assert.equal(a.available_cents, a.baseline_available_cents);
  const b = await f.call("/api/purchase/preview", {
    amount: 1500,
    date: today(),
    account_id: bank,
  });
  assert.equal(b.allowed, false);
  await f.call(
    "/api/purchase/preview",
    { amount: 10, date: addDays(today(), 90), account_id: bank },
    400,
  );
  await f.call(
    "/api/purchase/preview",
    { amount: 10, date: addDays(today(), -1), account_id: bank },
    400,
  );
  assert.deepEqual((await f.call("/api/export")).tables, initial.tables);
  state = await f.call("/api/account", { name: "Épargne", kind: "bank" });
  const savings = state.accounts.find((a) => a.name === "Épargne");
  const before = state.simulation.available_cents;
  state = await f.call("/api/checkpoint", {
    account_id: savings.id,
    amount: 5000,
  });
  assert.equal(
    state.account_balances.find((a) => a.id === savings.id).balance_cents,
    500000,
  );
  assert.equal(state.simulation.available_cents, before);
  await f.call(
    "/api/purchase/preview",
    { amount: 1, date: today(), account_id: savings.id },
    400,
  );
});
