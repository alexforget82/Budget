// Explicit return to 11.1.0. Only application code is replaced; current data is retained.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {releaseFiles} from './rollback-v111-manifest.js';

export function verifyRollbackRelease(folder) {
  for (const [name, expected] of Object.entries(releaseFiles)) {
    const file = path.join(folder, name);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected) {
      throw Error('Copie v11.1 incomplète ou modifiée : ' + name + '. Aucun retour effectué.');
    }
  }
  return folder;
}
export function preserveRollbackRelease(installed, dataDir) {
  const folder = path.join(dataDir, 'backups', 'sillage-v11.1.0-release');
  if (fs.existsSync(folder)) return verifyRollbackRelease(folder);
  const manifest = path.join(installed, 'package.json');
  if (!fs.existsSync(manifest) || JSON.parse(fs.readFileSync(manifest, 'utf8')).version !== '11.1.0') return null;
  // Verify before changing the running service or copying a new release.
  verifyRollbackRelease(installed);
  const stage = folder + '-' + randomUUID();
  fs.mkdirSync(stage, {recursive: true, mode: 0o700});
  try {
    for (const name of Object.keys(releaseFiles)) fs.copyFileSync(path.join(installed, name), path.join(stage, name));
    verifyRollbackRelease(stage);
    fs.renameSync(stage, folder);
  } finally {
    fs.rmSync(stage, {recursive: true, force: true});
  }
  return folder;
}

async function main() {
  if (process.platform !== 'darwin') throw Error('Ce retour nécessite macOS.');
  const root = path.join(os.homedir(), 'Library', 'Application Support', 'Mon Budget');
  const folder = verifyRollbackRelease(path.join(root, 'data', 'backups', 'sillage-v11.1.0-release'));
  const answer = spawnSync('/usr/bin/osascript', ['-e', 'display dialog "Revenir à Sillage v11.1 ? Vos transactions actuelles seront conservées. Une sauvegarde SQLite sera créée avant le retour." buttons {"Annuler", "Revenir à 11.1"} default button "Annuler"'], {encoding: 'utf8'});
  if (answer.status !== 0) {
    if (answer.stderr?.includes('-128')) return;
    throw Error(answer.stderr || 'Retour annulé.');
  }
  if (!answer.stdout.includes('Revenir à 11.1')) return;
  // The verified 11.1 installer stops only the matching service, backs up current
  // SQLite including WAL, installs code without copying data, and restarts it.
  const result = spawnSync(process.execPath, [path.join(folder, 'mac-service.js'), 'install', '--no-open'], {cwd: folder, stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (!process.exitCode) console.log('Retour à 11.1 terminé. Rechargez complètement Safari. Vos transactions actuelles sont conservées.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
