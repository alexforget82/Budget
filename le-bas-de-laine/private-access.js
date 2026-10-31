import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
const folder = path.join(os.homedir(), ".local/share/le-bas-de-laine/data");
if (!fs.existsSync(path.join(folder, "budget.sqlite")))
  throw Error("Installez d’abord Le bas de laine.");
const status = JSON.parse(
    execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" }),
  ),
  dns = status.Self?.DNSName?.replace(/\.$/, ""),
  user = status.User?.[String(status.Self?.UserID)];
if (
  status.BackendState !== "Running" ||
  !dns?.endsWith(".ts.net") ||
  !user?.LoginName
)
  throw Error("Connectez Tailscale dans Linux, puis relancez ce script.");
// Keep Sillage's HTTPS 443 configuration. Never overwrite another use of 8443.
const serving = JSON.parse(
  execFileSync("tailscale", ["serve", "status", "--json"], {
    encoding: "utf8",
  }),
);
const existing = Object.entries(serving.Web || {}).filter(([host]) =>
  host.endsWith(":8443"),
);
if (
  existing.some(
    ([, value]) => value.Handlers?.["/"]?.Proxy !== "http://127.0.0.1:3041",
  ) ||
  (serving.TCP?.["8443"] && !existing.length)
)
  throw Error(
    "Le port privé 8443 est déjà utilisé par un autre service. Aucune configuration remplacée.",
  );
const file = path.join(folder, "private-access.json"),
  config = { origin: "https://" + dns + ":8443", login: user.LoginName };
if (fs.existsSync(file)) {
  fs.mkdirSync(path.join(folder, "backups"), { recursive: true, mode: 0o700 });
  fs.copyFileSync(
    file,
    path.join(folder, "backups", "acces-prive-" + Date.now() + ".json"),
  );
}
fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
fs.chmodSync(file, 0o600);
const restart = spawnSync(
  "systemctl",
  ["--user", "restart", "le-bas-de-laine.service"],
  { stdio: "inherit" },
);
if (restart.status) process.exit(restart.status || 1);
const serve = spawnSync(
  "sudo",
  ["tailscale", "serve", "--bg", "--https=8443", "http://127.0.0.1:3041"],
  { stdio: "inherit" },
);
if (serve.status) process.exit(serve.status || 1);
console.log(
  "\nVotre nouvelle adresse : " +
    config.origin +
    "\nSillage conserve son accès sur le port HTTPS habituel.\nSur iPhone, connectez Tailscale et ouvrez cette adresse dans Safari.",
);
