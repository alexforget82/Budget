import { spawn, spawnSync } from "node:child_process";
const started = spawnSync(
  "systemctl",
  ["--user", "start", "le-bas-de-laine.service"],
  { stdio: "inherit" },
);
if (started.status) process.exit(started.status || 1);
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    ready = (
      await fetch("http://127.0.0.1:3040/api/state", {
        signal: AbortSignal.timeout(700),
      })
    ).ok;
  } catch {}
  if (ready) break;
  await new Promise((r) => setTimeout(r, 100));
}
if (!ready)
  throw Error(
    "Le service ne répond pas. Consultez journalctl --user -u le-bas-de-laine.service.",
  );
const browser = spawn("xdg-open", ["http://localhost:3040"], {
  detached: true,
  stdio: "ignore",
});
browser.on("error", () => console.error("Ouvrez http://localhost:3040"));
browser.unref();
