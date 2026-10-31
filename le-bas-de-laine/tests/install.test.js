import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { install, unit } from "../install.js";
const release = path.resolve(import.meta.dirname, "..");
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-install-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return { home, root: path.join(home, ".local/share/le-bas-de-laine") };
}
test("installation creates a distinct service and never reads or edits Sillage data", async (t) => {
  const { home, root } = fixture(t),
    old = path.join(home, ".local/share/sillage/data");
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, "budget.sqlite"), "SILLAGE LIVE SENTINEL");
  const calls = [];
  await install({
    home,
    release,
    command: (args) => {
      calls.push(args);
      return args[0] !== "is-active";
    },
    ready: async () => true,
    probe: async () => false,
  });
  assert.equal(
    fs.readFileSync(path.join(old, "budget.sqlite"), "utf8"),
    "SILLAGE LIVE SENTINEL",
  );
  assert.ok(fs.existsSync(path.join(root, "app/public/index.html")));
  assert.ok(
    fs.existsSync(
      path.join(home, ".local/share/applications/le-bas-de-laine.desktop"),
    ),
  );
  assert.ok(calls.some((a) => a.join() === "start,le-bas-de-laine.service"));
  assert.ok(calls.every((a) => !a.includes("sillage.service")));
});
test("an update backs up only its own data, retains old code and rolls back failed startup", async (t) => {
  const { home, root } = fixture(t),
    app = path.join(root, "app"),
    data = path.join(root, "data");
  fs.mkdirSync(app, { recursive: true });
  fs.mkdirSync(data);
  fs.writeFileSync(path.join(app, "old.js"), "old");
  fs.writeFileSync(path.join(data, "budget.sqlite"), "DATA SENTINEL");
  const command = () => true;
  await assert.rejects(
    install({
      home,
      release,
      command,
      ready: async () => false,
      probe: async () => false,
    }),
  );
  assert.equal(fs.readFileSync(path.join(app, "old.js"), "utf8"), "old");
  assert.equal(
    fs.readFileSync(path.join(data, "budget.sqlite"), "utf8"),
    "DATA SENTINEL",
  );
  assert.ok(fs.readdirSync(path.join(root, "backups")).length);
  await install({
    home,
    release,
    command,
    ready: async () => true,
    probe: async () => false,
  });
  assert.ok(fs.existsSync(path.join(root, "app.previous/old.js")));
  assert.equal(
    fs.readFileSync(path.join(data, "budget.sqlite"), "utf8"),
    "DATA SENTINEL",
  );
});
test("a manually running server prevents installation rather than being killed", async (t) => {
  const { home } = fixture(t);
  await assert.rejects(
    install({ home, release, command: () => false, probe: async () => true }),
    /3040/,
  );
});
test("real systemd parser accepts normal paths and paths with spaces, percent and dollar", (t) => {
  const { home } = fixture(t);
  if (spawnSync("systemd-analyze", ["--version"]).status) {
    t.skip("systemd-analyze indisponible");
    return;
  }
  for (const root of [
    path.join(home, "app"),
    path.join(home, "espace % $ app"),
  ]) {
    const file = path.join(home, "le-bas-de-laine.service");
    fs.writeFileSync(file, unit(process.execPath, root));
    const result = spawnSync("systemd-analyze", ["verify", file], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!fs.readFileSync(file, "utf8").includes('WorkingDirectory="'));
  }
});
test("the installed copy opens its own real SQLite schema and serves the application", async (t) => {
  const { home, root } = fixture(t);
  const { spawn } = await import("node:child_process");
  const net = await import("node:net");
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  let child;
  t.after(async () => {
    if (child?.exitCode === null) {
      const stopped = new Promise((r) => child.once("exit", r));
      child.kill();
      await stopped;
    }
  });
  await install({
    home,
    release,
    command: () => true,
    probe: async () => false,
    ready: async () => {
      child = spawn(process.execPath, [path.join(root, "app/server.js")], {
        cwd: root,
        env: {
          ...process.env,
          PORT: String(port),
          BDL_DATA: path.join(root, "data"),
        },
        stdio: "ignore",
      });
      for (let i = 0; i < 60; i++) {
        try {
          const response = await fetch(
            "http://127.0.0.1:" + port + "/api/state",
          );
          const s = await response.json();
          if (response.ok) {
            assert.equal(s.version, "0.4.0");
            assert.equal(s.configured, false);
            return true;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 50));
      }
      return false;
    },
  });
  assert.ok(fs.existsSync(path.join(root, "data/budget.sqlite")));
  assert.ok(fs.existsSync(path.join(root, "app/migrations/001-initial.sql")));
});
