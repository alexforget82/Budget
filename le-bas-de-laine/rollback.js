import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
function system(args, optional = false) {
  const r = spawnSync("systemctl", ["--user", ...args], { encoding: "utf8" });
  if (!optional && (r.error || r.status))
    throw Error(r.error?.message || r.stderr || "Service indisponible.");
  return r.status === 0;
}
async function check(version) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3040/api/state", {
        signal: AbortSignal.timeout(700),
      });
      if (r.ok && (await r.json()).version === version) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
export async function rollback({
  home = os.homedir(),
  confirm = false,
  command = system,
  ready = check,
} = {}) {
  if (!confirm)
    throw Error(
      "Le retour restaure le programme ET le budget sauvegardé avant la dernière mise à jour. Ajoutez --confirmer; le budget actuel sera conservé dans une copie séparée.",
    );
  const root = path.join(home, ".local/share/le-bas-de-laine"),
    app = path.join(root, "app"),
    previous = path.join(root, "app.previous"),
    data = path.join(root, "data"),
    manifest = path.join(root, "previous-installation.json");
  if (!fs.existsSync(manifest))
    throw Error(
      "Aucun retour automatique disponible. Le budget actuel est conservé.",
    );
  const info = JSON.parse(fs.readFileSync(manifest, "utf8"));
  if (
    info.format !== "le-bas-de-laine-rollback" ||
    info.rolled_back_at ||
    !/^backups\/avant-installation-[A-Za-z0-9-]+$/.test(info.backup || "")
  )
    throw Error("Retour indisponible ou déjà effectué.");
  const source = path.join(root, info.backup, "data");
  if (
    !fs.existsSync(path.join(source, "budget.sqlite")) ||
    !fs.existsSync(path.join(previous, "package.json"))
  )
    throw Error("Copie ou programme précédent introuvable.");
  for (const file of [root, previous, source])
    if (fs.lstatSync(file).isSymbolicLink())
      throw Error("Chemin de retour inattendu.");
  const pkg = JSON.parse(
    fs.readFileSync(path.join(previous, "package.json"), "utf8"),
  );
  if (pkg.name !== "le-bas-de-laine" || pkg.version !== info.previous_version)
    throw Error(
      "La copie du programme ne correspond pas au budget sauvegardé.",
    );
  if (!fs.existsSync(app) || !fs.existsSync(path.join(data, "budget.sqlite")))
    throw Error("Installation actuelle incomplète : aucune modification.");
  const saved = fs.mkdtempSync(path.join(root, "backups", "avant-retour-"));
  const wasActive = command(
    ["is-active", "--quiet", "le-bas-de-laine.service"],
    true,
  );
  command(["stop", "le-bas-de-laine.service"]);
  let movedApp = false,
    movedData = false;
  try {
    if (fs.existsSync(app)) {
      fs.renameSync(app, path.join(saved, "app"));
      movedApp = true;
    }
    if (fs.existsSync(data)) {
      fs.renameSync(data, path.join(saved, "data"));
      movedData = true;
    }
    fs.cpSync(previous, app, { recursive: true });
    fs.cpSync(source, data, { recursive: true });
    command(["start", "le-bas-de-laine.service"]);
    if (!(await ready(pkg.version)))
      throw Error(
        "La version précédente ne répond pas; le budget courant sera rétabli.",
      );
    const temp = manifest + ".next";
    fs.writeFileSync(
      temp,
      JSON.stringify(
        {
          ...info,
          rolled_back_at: new Date().toISOString(),
          current_copy: path.relative(root, saved),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    fs.renameSync(temp, manifest);
    return { version: pkg.version, saved };
  } catch (error) {
    command(["stop", "le-bas-de-laine.service"], true);
    if (movedApp) {
      fs.rmSync(app, { recursive: true, force: true });
      fs.renameSync(path.join(saved, "app"), app);
    }
    if (movedData) {
      fs.rmSync(data, { recursive: true, force: true });
      fs.renameSync(path.join(saved, "data"), data);
    }
    if (wasActive) command(["start", "le-bas-de-laine.service"], true);
    throw error;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  rollback({ confirm: process.argv.includes("--confirmer") })
    .then((r) =>
      console.log(
        "Version " +
          r.version +
          " rétablie. Budget récent conservé : " +
          r.saved +
          "\nActualisez votre navigateur.",
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
