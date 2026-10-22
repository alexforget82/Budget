// A locally installed shortcut selects a downloaded release explicitly.
// No global Gatekeeper changes and no quarantine attributes are removed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
export function validateUpdateFolder(folder, currentVersion) {
  const root = fs.realpathSync(folder),
    manifest = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
  const version = (v) =>
    /^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null;
  const incoming = version(manifest.version),
    current = version(currentVersion);
  if (manifest.name !== "mon-budget-local" || !incoming || !current)
    throw Error(
      "Choisissez le dossier complet de Sillage décompressé depuis votre dépôt GitHub.",
    );
  for (let i = 0; i < 3; i++) {
    if (incoming[i] < current[i])
      throw Error("Cette version est plus ancienne que la version installée.");
    if (incoming[i] > current[i]) break;
  }
  for (const name of [
    "money.js",
    "sillage-v14.js",
    "styles-v14.css",
    "entry-memory.js",
    "card-payment-actual-ui.js",
    "card-payment-actions.js",
    "envelope-entry-ui.js",
    "sillage-v13.js",
    "styles-v13.css",
    "mobile-ui.js",
    "styles-mobile.css",
    "chatgpt-export.js",
    "database.js",
    "recurrence-calendar.js",
    "http-assets.js",
    "http-body.js",
    "http-security.js",
    "routes-accounts.js",
    "routes-envelopes.js",
    "routes-planning.js",
    "routes-read.js",
    "routes-recurrences.js",
    "routes-transactions.js",
    "routes-transfers.js",
    "ui-entry.js",
    "styles.css",
    "styles-foundation.css",
    "styles-domains.css",
    "styles-sillage.css",
    "styles-tokens.css",
    "budget-calendar.js",
    "database-migrations.js",
    "database-migration-001.js",
    "mac-rollback.js",
    "rollback-v111-manifest.js",
    "sillage-2026.js",
    "sillage-2026.css",
    "sillage-v10.js",
    "budget-start.js",
    "sillage-icon.png",
    "sillage.webmanifest",
    "pro-workspace.js",
    "sillage.js",
    "sillage.css",
    "sillage-logo.svg",
    "budget-v81.js",
    "budget-v81.css",
    "budget-tools-v80.js",
    "budget-v80.js",
    "budget-v80.css",
    "global-budget.js",
    "shared-view.html",
    "budget-v73.js",
    "card-envelope-funds.js",
    "budget-banking.js",
    "budget-v71.js",
    "budget-journey.js",
    "demo-workspace.js",
    "budget-v70.js",
    "budget-v70.css",
    "budget-schedule.js",
    "monthly-budget.js",
    "budget-v60.js",
    "budget-v60.css",
    "mac-service.js",
    "mac-update.js",
    "server.js",
    "index.html",
    "planning-v4.js",
    "planning-v4.css",
    "budget-support.js",
    "budget-v41.js",
    "budget-v41.css",
    "free-budgets.js",
    "free-budgets-ui.js",
    "free-budgets.css",
    "envelope-tools.js",
    "envelope-v44.js",
    "envelope-v44.css",
    "category-tools.js",
    "categories-v46.js",
    "categories-v46.css",
    "dashboard-layout.js",
    "dashboard-v47.js",
    "dashboard-v47.css",
    "budget-life.js",
    "budget-v50.js",
    "budget-v50.css",
    "Acces prive iPhone.command",
  ])
    if (!fs.statSync(path.join(root, name)).isFile())
      throw Error("Version incomplète : " + name);
  for (const match of fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .matchAll(
      /(?:src|href)="\/([A-Za-z0-9][A-Za-z0-9._-]*)(?:\?v=\d+\.\d+\.\d+)?"/g,
    ))
    if (!fs.statSync(path.join(root, match[1])).isFile())
      throw Error("Version incomplète : " + match[1]);
  return root;
}
function main() {
  if (process.platform !== "darwin")
    throw Error("Cette mise à jour nécessite macOS.");
  const chosen = spawnSync(
    "/usr/bin/osascript",
    [
      "-e",
      'POSIX path of (choose folder with prompt "Choisissez le dossier Sillage du nouveau ZIP téléchargé depuis votre dépôt GitHub. Son installateur sera exécuté.")',
    ],
    { encoding: "utf8" },
  );
  if (chosen.status !== 0) {
    if (chosen.stderr?.includes("-128")) return;
    throw Error(chosen.stderr || "Impossible de choisir le dossier.");
  }
  const version = JSON.parse(
    fs.readFileSync(new URL("./package.json", import.meta.url)),
  ).version;
  const folder = validateUpdateFolder(chosen.stdout.trim(), version);
  const result = spawnSync(
    process.execPath,
    [path.join(folder, "mac-service.js"), "install", "--no-open"],
    { cwd: folder, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }

// Public version metadata only; no financial data, link or identity is sent.
export async function checkPublicRelease(currentVersion, fetchImpl = fetch) {
  const parse = (v) =>
    /^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null;
  const installed = parse(currentVersion);
  if (!installed) throw Error("Version installée invalide.");
  const response = await fetchImpl(
    "https://raw.githubusercontent.com/alexforget82/Budget/main/package.json",
    {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      headers: { Accept: "application/json" },
      credentials: "omit",
    },
  );
  if (!response.ok) throw Error("Vérification des mises à jour indisponible.");
  const reader = response.body.getReader();
  let count = 0,
    parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > 8192) throw Error("Réponse de version trop volumineuse.");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(count);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  const manifest = JSON.parse(new TextDecoder().decode(bytes)),
    latest = parse(manifest.version);
  if (manifest.name !== "mon-budget-local" || !latest)
    throw Error("Version publiée invalide.");
  let available = false;
  for (let i = 0; i < 3; i++) {
    if (latest[i] !== installed[i]) {
      available = latest[i] > installed[i];
      break;
    }
  }
  return {
    installed_version: currentVersion,
    latest_version: manifest.version,
    available,
    download_url: available
      ? "https://github.com/alexforget82/Budget/archive/refs/tags/v" +
        manifest.version +
        ".zip"
      : null,
  };
}
