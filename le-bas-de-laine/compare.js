import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL, fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";
import { planSillage, applySillage } from "./import.js";
import { simulate } from "./engine.js";
import { today, validDate } from "./dates.js";
// Read code from the installed Sillage; NEVER use its live data directory.
export async function sourceSnapshot(backup, reference, sillageDir) {
  const root = path.resolve(sillageDir);
  if (!fs.existsSync(path.join(root, "server.js")))
    throw Error(
      "Programme Sillage introuvable. Utilisez --sillage-dir ~/.local/share/sillage/app.",
    );
  const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "bdl-sillage-reference-"),
    ),
    clock = path.join(folder, "fixed-clock.mjs");
  fs.writeFileSync(
    clock,
    `const RealDate=Date;const ms=RealDate.parse(${JSON.stringify(reference + "T16:00:00Z")});globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[ms]));}static now(){return ms;}};`,
  );
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const child = spawn(
    process.execPath,
    ["--import", pathToFileURL(clock).href, path.join(root, "server.js")],
    {
      cwd: folder,
      env: { ...process.env, PORT: String(port), TZ: "America/Toronto" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let errors = "";
  child.stderr.on("data", (b) => {
    errors = (errors + b).slice(-5000);
  });
  const base = "http://127.0.0.1:" + port;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready = (
          await fetch(base + "/api/state", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {}
      if (ready) break;
      if (child.exitCode !== null)
        throw Error("Copie Sillage arrêtée : " + errors);
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("La copie Sillage ne répond pas.");
    const restored = await fetch(base + "/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backup, confirm: "REMPLACER" }),
    });
    if (!restored.ok)
      throw Error(
        "La copie Sillage refuse la sauvegarde : " +
          (await restored.json()).error,
      );
    return await (await fetch(base + "/api/state")).json();
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      let timeout;
      await Promise.race([
        exited,
        new Promise((r) => {
          timeout = setTimeout(() => {
            child.kill("SIGKILL");
            r();
          }, 3000);
        }),
      ]);
      clearTimeout(timeout);
    }
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
export function compareForecasts(oldState, newSimulation, decisions = {}) {
  const differences = [];
  for (const d of newSimulation.daily) {
    const old = oldState.forecast.find((v) => v.date === d.date);
    if (!old) {
      differences.push({
        date: d.date,
        component: "reference",
        message: "Date absente de la référence Sillage.",
        classification: null,
      });
      continue;
    }
    for (const [component, previous, current] of [
      ["solde", old.cash_cents, d.cash_cents],
      ["cartes", old.card_envelope_reserved_cents || 0, d.card_cents],
      [
        "limites",
        old.envelope_reserved_cents ??
          old.reserved_cents - (old.card_envelope_reserved_cents || 0),
        d.limits_cents,
      ],
      ["disponible", old.safe_cents, d.safe_cents],
    ]) {
      if (previous === current) continue;
      const key = d.date + ":" + component,
        decision = decisions[key];
      if (
        decision &&
        (![
          "règle volontairement différente",
          "erreur de Sillage",
          "erreur de la nouvelle application",
        ].includes(decision.classification) ||
          typeof decision.explanation !== "string" ||
          decision.explanation.trim().length < 15)
      )
        throw Error("Décision insuffisamment expliquée : " + key);
      differences.push({
        key,
        date: d.date,
        component,
        sillage_cents: previous,
        bas_de_laine_cents: current,
        difference_cents: current - previous,
        classification: decision?.classification || null,
        explanation:
          decision?.explanation ||
          "À examiner : aucun moteur n’est déclaré fautif automatiquement.",
        source_events: old.events?.map((e) => ({
          name: e.description,
          kind: e.type,
          amount_cents: e.amount_cents,
        })),
        new_events: d.events.map((e) => ({
          name: e.name,
          kind: e.kind,
          amount_cents: e.amount_cents,
        })),
      });
    }
  }
  const oldWindow = oldState.forecast.filter(
      (d) => d.date <= newSimulation.until,
    ),
    oldAvailable = Math.min(
      oldState.safe_cents,
      ...oldWindow.map((d) => d.safe_cents),
    ),
    oldMinimum = Math.min(
      ...oldState.forecast.slice(0, 90).map((d) => d.safe_cents),
    );
  return {
    indicators: {
      available: {
        sillage_cents: oldAvailable,
        bas_de_laine_cents: newSimulation.available_cents,
      },
      minimum_90: {
        sillage_cents: oldMinimum,
        bas_de_laine_cents: newSimulation.minimum_cents,
      },
    },
    differences,
    unclassified: differences.filter((d) => !d.classification).length,
    validated: !differences.some(
      (d) =>
        !d.classification ||
        d.classification === "erreur de la nouvelle application",
    ),
  };
}
export async function compareBackup(
  backup,
  { reference = today(), sillageDir, decisions = {} },
) {
  if (!validDate(reference) || reference > today())
    throw Error("Date de référence invalide.");
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "bdl-comparison-")),
    store = openDatabase(folder);
  try {
    const plan = planSillage(backup, reference, store.state());
    store.atomic(() => applySillage(store, plan));
    const simulation = simulate(store.state(), reference),
      old = await sourceSnapshot(backup, reference, sillageDir),
      report = compareForecasts(old, simulation, decisions);
    return {
      application: "Le bas de laine",
      version: "0.4.1",
      reference,
      horizon: 90,
      source_created_at: backup.created_at,
      live_data_touched: false,
      import_warnings: plan.warnings,
      ...report,
      validated: report.validated && !plan.warnings.some((w) => w.blocking),
    };
  } finally {
    store.db.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
async function main() {
  const args = process.argv.slice(2),
    filename = args.shift();
  if (!filename)
    throw Error(
      "Usage : node compare.js sauvegarde.json [--date AAAA-MM-JJ] [--sillage-dir dossier] [--output rapport.json] [--decisions decisions.json]",
    );
  const options = {
      sillageDir: fs.existsSync(
        path.join(os.homedir(), ".local/share/sillage/app/server.js"),
      )
        ? path.join(os.homedir(), ".local/share/sillage/app")
        : path.resolve(import.meta.dirname, ".."),
    },
    backup = JSON.parse(fs.readFileSync(filename, "utf8"));
  let output = "comparaison-bas-de-laine.json";
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (!value) throw Error("Option incomplète.");
    if (key === "--date") options.reference = value;
    else if (key === "--sillage-dir") options.sillageDir = value;
    else if (key === "--output") output = value;
    else if (key === "--decisions")
      options.decisions = JSON.parse(fs.readFileSync(value, "utf8"));
    else throw Error("Option inconnue : " + key);
  }
  const report = await compareBackup(backup, options);
  fs.writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    report.validated
      ? "Comparaison validée."
      : "Comparaison à examiner : " +
          report.unclassified +
          " écart(s) non classé(s).",
  );
  console.log("Rapport local : " + path.resolve(output));
  if (!report.validated) process.exitCode = 2;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
