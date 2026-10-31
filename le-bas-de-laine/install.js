import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
export function quote(value) {
  if (/[\r\n\0]/.test(value)) throw Error("Chemin invalide.");
  return (
    '"' +
    value
      .replaceAll("%", "%%")
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("$", "$$") +
    '"'
  );
}
export function unit(node, root) {
  if (!path.isAbsolute(root) || /[\r\n\0]/.test(root))
    throw Error("Chemin absolu requis.");
  return `[Unit]\nDescription=Le bas de laine\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${root.replaceAll("%", "%%")}\nExecStart=${quote(node)} ${quote(path.join(root, "app/server.js"))}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`;
}
const source = path.dirname(fileURLToPath(import.meta.url));
function system(args, optional = false) {
  const r = spawnSync("systemctl", ["--user", ...args], { encoding: "utf8" });
  if (!optional && (r.error || r.status))
    throw Error(r.error?.message || r.stderr || "Le service n’a pas démarré.");
  return r.status === 0;
}
export async function install({
  home = os.homedir(),
  release = source,
  command = system,
  ready = async () => {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch("http://127.0.0.1:3040/api/state", {
            signal: AbortSignal.timeout(700),
          }),
          data = await r.json();
        if (r.ok && data.version === "0.3.0") return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  },
  probe = async () => {
    try {
      return (
        await fetch("http://127.0.0.1:3040/api/state", {
          signal: AbortSignal.timeout(800),
        })
      ).ok;
    } catch {
      return false;
    }
  },
} = {}) {
  if (process.platform !== "linux")
    throw Error(
      "Ce script est destiné à Linux / Chromebook. Pour un autre ordinateur : npm start.",
    );
  const root = path.join(home, ".local/share/le-bas-de-laine"),
    app = path.join(root, "app"),
    previous = path.join(root, "app.previous"),
    unitDir = path.join(home, ".config/systemd/user"),
    unitFile = path.join(unitDir, "le-bas-de-laine.service"),
    staging = path.join(root, "app.next-" + Date.now());
  if (
    JSON.parse(fs.readFileSync(path.join(release, "package.json"), "utf8"))
      .name !== "le-bas-de-laine"
  )
    throw Error("Dossier de programme invalide.");
  const oldUnit = fs.existsSync(unitFile) ? fs.readFileSync(unitFile) : null,
    wasActive = command(
      ["is-active", "--quiet", "le-bas-de-laine.service"],
      true,
    );
  let switched = false;
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.mkdirSync(unitDir, { recursive: true });
  command(["stop", "le-bas-de-laine.service"], true);
  try {
    if (await probe())
      throw Error(
        "Un serveur manuel utilise déjà 3040. Arrêtez cette instance avant l’installation. Sillage sur 3030 peut rester ouvert.",
      );
    if (fs.existsSync(path.join(root, "data"))) {
      const backup = path.join(
        root,
        "backups",
        "avant-installation-" + Date.now(),
      );
      fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
      fs.cpSync(path.join(root, "data"), path.join(backup, "data"), {
        recursive: true,
      });
    }
    fs.mkdirSync(staging);
    for (const entry of fs.readdirSync(release, { withFileTypes: true })) {
      if (
        (entry.isFile() && /\.(js|json|md|sh)$/.test(entry.name)) ||
        (entry.isDirectory() && ["public", "migrations"].includes(entry.name))
      )
        fs.cpSync(
          path.join(release, entry.name),
          path.join(staging, entry.name),
          { recursive: entry.isDirectory() },
        );
    }
    if (fs.existsSync(path.join(previous, "data")))
      throw Error(
        "Le programme précédent contient des données inattendues : conservé sans remplacement.",
      );
    fs.rmSync(previous, { recursive: true, force: true });
    if (fs.existsSync(app)) fs.renameSync(app, previous);
    fs.renameSync(staging, app);
    switched = true;
    fs.writeFileSync(unitFile, unit(process.execPath, root));
    command(["daemon-reload"]);
    command(["enable", "le-bas-de-laine.service"]);
    command(["start", "le-bas-de-laine.service"]);
    if (!(await ready()))
      throw Error(
        "Le nouveau service ne répond pas. Le programme précédent sera rétabli.",
      );
    const launcher = path.join(home, ".local/share/applications");
    fs.mkdirSync(launcher, { recursive: true });
    // Desktop launchers have their own argument grammar; escape without invoking a shell.
    const desktopQuote = (value) =>
      '"' + value.replace(/([\\"`$])/g, "\\$1").replaceAll("%", "%%") + '"';
    fs.writeFileSync(
      path.join(launcher, "le-bas-de-laine.desktop"),
      `[Desktop Entry]\nType=Application\nName=Le bas de laine\nExec=${desktopQuote(process.execPath)} ${desktopQuote(path.join(app, "open.js"))}\nIcon=${path.join(app, "public/logo.svg")}\nTerminal=false\nCategories=Office;Finance;\n`,
    );
    return root;
  } catch (e) {
    command(["stop", "le-bas-de-laine.service"], true);
    if (switched) {
      fs.rmSync(app, { recursive: true, force: true });
      if (fs.existsSync(previous)) fs.renameSync(previous, app);
    }
    if (oldUnit) fs.writeFileSync(unitFile, oldUnit);
    else fs.rmSync(unitFile, { force: true });
    command(["daemon-reload"], true);
    if (wasActive) command(["start", "le-bas-de-laine.service"], true);
    throw e;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  install()
    .then((root) =>
      console.log(
        "Le bas de laine est installé.\nOuvrez-le dans le lanceur Linux ou actualisez http://localhost:3040.\nDonnées : " +
          root +
          "/data\nSillage est resté intact.",
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
