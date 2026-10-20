// Numbered, atomic schema upgrades. Backups are coherent SQLite snapshots, including WAL.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import * as initial from './database-migration-001.js';

const migrations = [{version: 1, name: '001-schema-sillage-11.1', apply: initial.apply}];
export const schemaVersion = migrations.at(-1).version;
const reference = new DatabaseSync(':memory:');
reference.exec(Object.values(initial.schema).join(';'));
const columns = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all();

function checkKnownSchema(db, complete) {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
  if (!names.length && !complete) return;
  if (!['accounts', 'envelopes', 'transactions'].every(t => names.includes(t))) {
    throw Error('Schéma de budget incomplet ou inconnu. Aucune migration effectuée.');
  }
  for (const name of names) {
    if (!Object.hasOwn(initial.schema, name)) throw Error('Table inconnue : ' + name + '. Migration arrêtée pour conserver vos données.');
    const expected = new Map(columns(reference, name).map(c => [c.name, c]));
    const actual = columns(db, name);
    for (const column of actual) {
      const target = expected.get(column.name);
      if (!target || column.type.toUpperCase() !== target.type.toUpperCase() || column.pk !== target.pk || column.notnull !== target.notnull) {
        throw Error('Colonne non reconnue : ' + name + '.' + column.name + '. Aucune migration effectuée.');
      }
    }
    const expectedLinks = reference.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const actualLinks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const linkKey = r => JSON.stringify([r.table,r.from,r.to,r.on_update,r.on_delete,r.match]);
    const wantedLinks = expectedLinks.filter(r => actual.some(c => c.name === r.from)).map(linkKey).sort();
    if (JSON.stringify(actualLinks.map(linkKey).sort()) !== JSON.stringify(wantedLinks)) {
      throw Error('Relations non reconnues dans ' + name + '. Migration arrêtée.');
    }
    const required = complete ? [...expected.keys()] : [...expected.keys()].filter(c => !Object.hasOwn(initial.additions[name] || {}, c));
    if (required.some(c => !actual.some(a => a.name === c))) throw Error('Colonnes manquantes dans ' + name + '. Migration arrêtée.');
  }
  if (complete && Object.keys(initial.schema).some(t => !names.includes(t))) throw Error('Le schéma versionné est incomplet.');
  const recurring = db.prepare("SELECT sql FROM sqlite_master WHERE name='recurring'").get()?.sql;
  if (recurring && !['quarterly','semiannual','yearly','last_business_day','rrq'].every(f => recurring.includes("'" + f + "'"))) {
    const normalize = sql => sql.toLowerCase().replaceAll('"','').replace(/\s+/g,'').replace(/;$/,'');
    const canonical = normalize(initial.schema.recurring);
    const accepted = new Set();
    for (const frequencies of ["'weekly','biweekly','monthly'", "'weekly','biweekly','monthly','last_business_day','rrq'", "'weekly','biweekly','monthly','quarterly','semiannual','yearly','last_business_day','rrq'"]) {
      for (const dayAdjust of [true,false]) for (const oneTime of [true,false]) {
        let sql = canonical.replace("'weekly','biweekly','monthly','quarterly','semiannual','yearly','last_business_day','rrq'", frequencies);
        if (!dayAdjust) sql = sql.replace(",day_adjusttextnotnulldefault'none'",'');
        if (!oneTime) sql = sql.replace(',one_timeintegernotnulldefault0check(one_timein(0,1))','');
        accepted.add(sql);
      }
    }
    if (!accepted.has(normalize(recurring))) throw Error('Définition de recurring non reconnue. Migration arrêtée pour préserver ses contraintes.');
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE tbl_name='recurring' AND type IN ('index','trigger') AND sql IS NOT NULL").get()) {
      throw Error('Index ou déclencheur personnalisé sur recurring : migration arrêtée pour ne pas le perdre.');
    }
  }
}

export function migrateDatabase(db, {dataDir, today}) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > schemaVersion) throw Error('Cette base exige une version plus récente de Sillage. Aucune modification effectuée.');
  checkKnownSchema(db, version === schemaVersion);
  if (version === schemaVersion) return {version, backup: null};

  const existing = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get();
  let backup = null;
  if (existing) {
    const folder = path.join(dataDir, 'backups');
    fs.mkdirSync(folder, {recursive: true, mode: 0o700});
    backup = path.join(folder, `budget-before-schema-v${schemaVersion}-${Date.now()}-${randomUUID()}.sqlite`);
    // Failure aborts startup before any schema/data change. Never overwrite a prior backup.
    db.prepare('VACUUM INTO ?').run(backup);
    fs.chmodSync(backup, 0o600);
  }

  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try {
    for (const migration of migrations.filter(m => m.version > version)) {
      migration.apply(db, today);
      db.exec(`PRAGMA user_version=${migration.version}`);
    }
    checkKnownSchema(db, true);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Liens invalides dans la base migrée.');
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('Intégrité SQLite invalide.');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw Error('Migration annulée; la base originale est conservée. ' + error.message + (backup ? ' Copie : ' + backup : ''), {cause: error});
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }
  return {version: schemaVersion, backup};
}
