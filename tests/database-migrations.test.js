import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {migrateDatabase} from '../database-migrations.js';
import {schema} from '../database-migration-001.js';

const today = '2026-10-20';
function fixture(t, legacyFrequency=false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sillage migration '));
  const file = path.join(root, 'budget.sqlite');
  const db = new DatabaseSync(file);
  t.after(() => {db.close(); fs.rmSync(root, {recursive:true,force:true});});
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL');
  for (let ddl of Object.values(schema)) {
    if (legacyFrequency) ddl = ddl.replace("'quarterly','semiannual','yearly',", '');
    db.exec(ddl);
  }
  db.exec(`
    INSERT INTO accounts VALUES(7,'Conjoint',123456,'checking',1);
    INSERT INTO accounts VALUES(8,'CIBC',-5000,'credit',0);
    INSERT INTO envelopes VALUES(9,'Essence',6000,6000,'weekly','2026-10-22',0,1,8,1,'2026-10-01');
    INSERT INTO categories VALUES(3,'Transport',0);
    INSERT INTO subcategories VALUES(4,3,'Essence',0);
    INSERT INTO import_batches VALUES(1,'2026-10-01',7,0,1);
    INSERT INTO transactions VALUES(11,7,9,-5500,'Station','2026-10-20',1,4,3,1,1,5500);
    INSERT INTO recurring VALUES(12,'Essence','expense',6000,8,NULL,9,'2026-10-22','monthly',1,'none',0);
    INSERT INTO recurring VALUES(13,'Paiement carte','transfer',6000,7,8,NULL,'2026-10-22','monthly',1,'none',0);
    INSERT INTO account_transfers VALUES(14,7,8,5000,'Paiement','2026-10-20',NULL,0,NULL);
    INSERT INTO recurring_overrides VALUES(15,12,'2026-11-22',5500);
    INSERT INTO envelope_renewal_log VALUES(9,'2026-10-15',6000);
    INSERT INTO envelope_budget_overrides VALUES(9,'2026-11-22',5500);
    INSERT INTO recurring_moves VALUES(12,'2026-10-22','2026-10-23');
    INSERT INTO reconciliation_links VALUES(16,12,'2026-09-22','transaction',11);
    INSERT INTO category_budgets VALUES(3,26000);
    INSERT INTO goals VALUES(17,'Maison',100000,1000,'2027-01-01');
    INSERT INTO balance_reconciliations VALUES(18,7,120000,123456,'2026-10-20','Vérifié');
    INSERT INTO envelope_period_status VALUES(9,'2026-09-22','complete');
    INSERT INTO envelope_occurrence_moves VALUES(9,'2026-10-22','2026-10-23');
    INSERT INTO envelope_actual_links VALUES(11,9,'2026-09-22');
    INSERT INTO card_payment_plans VALUES(8,13,'purchases');
    INSERT INTO app_settings VALUES('renewal_activation','2026-10-01');
    INSERT INTO app_settings VALUES('features_v3','1');
    INSERT INTO app_settings VALUES('forecast_tracking_since','2026-10-01');
    INSERT INTO app_settings VALUES('planning_actions_v1','1');
    INSERT INTO app_settings VALUES('card_payments_v1','1');
    INSERT INTO app_settings VALUES('global_budget_v74','{"plans":{},"subplans":{}}');
  `);
  return {root,file,db};
}
const rows = db => Object.fromEntries(Object.keys(schema).map(t => [t,db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
const options = root => ({dataDir:root,today});

test('11.1 adoption preserves every table, snapshots committed WAL and is idempotent', t => {
  const {db,root} = fixture(t), before = rows(db);
  const result = migrateDatabase(db,options(root));
  assert.equal(result.version,1);assert.deepEqual(rows(db),before);
  assert.equal(fs.statSync(result.backup).mode & 0o777,0o600);
  const backup = new DatabaseSync(result.backup,{readOnly:true});
  assert.equal(backup.prepare('PRAGMA user_version').get().user_version,0);
  assert.deepEqual(rows(backup),before);assert.equal(backup.prepare('PRAGMA integrity_check').get().integrity_check,'ok');backup.close();
  const files = fs.readdirSync(path.join(root,'backups'));
  assert.equal(migrateDatabase(db,options(root)).backup,null);
  assert.deepEqual(fs.readdirSync(path.join(root,'backups')),files);assert.deepEqual(rows(db),before);
});
test('explicit recurring rebuild preserves all IDs, overrides and dependent links', t => {
  const {db,root} = fixture(t,true), before = rows(db);
  migrateDatabase(db,options(root));assert.deepEqual(rows(db),before);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const frequency of ['quarterly','semiannual','yearly','last_business_day']) db.prepare('UPDATE recurring SET frequency=? WHERE id=12').run(frequency);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
});
test('a coherent migration backup can actually be restored and migrated again', t => {
  const {db,root} = fixture(t), before = rows(db), {backup} = migrateDatabase(db,options(root));
  db.exec('UPDATE accounts SET balance_cents=1');
  const restoredFile = path.join(root,'restored.sqlite');fs.copyFileSync(backup,restoredFile);
  const restored = new DatabaseSync(restoredFile);
  try{assert.deepEqual(rows(restored),before);migrateDatabase(restored,options(path.join(root,'restored-data')));assert.deepEqual(rows(restored),before);assert.equal(restored.prepare('PRAGMA user_version').get().user_version,1);}finally{restored.close();}
});
test('migration failure rolls back schema and data, retaining the recovery snapshot', t => {
  const {db,root} = fixture(t,true);
  db.exec('PRAGMA foreign_keys=OFF; UPDATE transactions SET account_id=999; PRAGMA foreign_keys=ON');
  const before = rows(db), ddl = db.prepare("SELECT sql FROM sqlite_master WHERE name='recurring'").get().sql;
  assert.throws(()=>migrateDatabase(db,options(root)),/Migration annulée/);
  assert.deepEqual(rows(db),before);assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name='recurring'").get().sql,ddl);
  assert.equal(fs.readdirSync(path.join(root,'backups')).length,1);
});
test('backup failure prevents migration and leaves the original ledger untouched', t => {
  const {db,root} = fixture(t), before = rows(db);fs.writeFileSync(path.join(root,'backups'),'blocked');
  assert.throws(()=>migrateDatabase(db,options(root)));assert.deepEqual(rows(db),before);assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);
});
test('future versions, unknown columns/tables and custom indexes are never silently stamped or lost', t => {
  const {db,root} = fixture(t,true), before = rows(db);
  db.exec('PRAGMA user_version=999');assert.throws(()=>migrateDatabase(db,options(root)),/version plus récente/);assert.deepEqual(rows(db),before);
  db.exec('PRAGMA user_version=0; CREATE TABLE personal_extension(id INTEGER PRIMARY KEY)');assert.throws(()=>migrateDatabase(db,options(root)),/Table inconnue/);db.exec('DROP TABLE personal_extension');
  db.exec('ALTER TABLE recurring ADD COLUMN custom_note TEXT');assert.throws(()=>migrateDatabase(db,options(root)),/Colonne non reconnue/);db.exec('ALTER TABLE recurring DROP COLUMN custom_note');
  db.exec('CREATE INDEX custom_index ON recurring(description)');assert.throws(()=>migrateDatabase(db,options(root)),/Index ou déclencheur/);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);assert.equal(fs.existsSync(path.join(root,'backups')),false);
});
test('fresh databases receive the complete schema and original default settings', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillage fresh ')),db=new DatabaseSync(path.join(root,'budget.sqlite'));t.after(()=>{db.close();fs.rmSync(root,{recursive:true,force:true});});
  const result=migrateDatabase(db,options(root));assert.equal(result.backup,null);assert.equal(Object.keys(rows(db)).length,21);assert.equal(db.prepare('SELECT COUNT(*) n FROM categories').get().n,10);assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='renewal_activation'").get().value,today);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
