import {createBudgetLife} from './budget-life.js';
import {createDashboardLayout} from './dashboard-layout.js';
import {createCategoryTools} from './category-tools.js';
import {createEnvelopeTools} from './envelope-tools.js';
import {createFreeBudgets} from './free-budgets.js';
import {createSupport} from './budget-support.js';
import http from 'node:http';
import {createCardPayments} from './card-payments.js';
import {loadPrivateAccess,authorizePrivateRequest} from './private-access.js';
import {createHash} from 'node:crypto';
import {createPlanningActions} from './planning-actions.js';
import {buildForecast} from './forecast-engine.js';
import {createFeatures} from './budget-features.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const HOST='127.0.0.1',PORT=Number(process.env.PORT||3030);
const dir=path.join(process.cwd(),'data');fs.mkdirSync(dir,{recursive:true,mode:0o700});
const privateAccess=loadPrivateAccess(dir,PORT);
// Sauvegarde avant toute migration (et avant l'ouverture de la base).
const databasePath=path.join(dir,'budget.sqlite');
if(fs.existsSync(databasePath)&&!fs.existsSync(path.join(dir,'backups','.v2-backup-complete'))){
 const backups=path.join(dir,'backups');fs.mkdirSync(backups,{recursive:true,mode:0o700});
 const backup=path.join(backups,'budget-before-v2-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
 // Copie cohérente du fichier principal + WAL/SHM lorsqu'ils existent.
 for(const suffix of ['','-wal','-shm'])if(fs.existsSync(databasePath+suffix))fs.copyFileSync(databasePath+suffix,backup+suffix);
 fs.writeFileSync(path.join(backups,'.v2-backup-complete'),backup);
}
// v2.1 : sauvegarde unique avant les migrations additives, y compris depuis v2.0.2.
if(fs.existsSync(databasePath)&&!fs.existsSync(path.join(dir,'backups','.v2.1-backup-complete'))){
 const backups=path.join(dir,'backups');fs.mkdirSync(backups,{recursive:true,mode:0o700});
 const backup=path.join(backups,'budget-before-v2.1-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
 for(const suffix of ['','-wal','-shm'])if(fs.existsSync(databasePath+suffix))fs.copyFileSync(databasePath+suffix,backup+suffix);
 fs.writeFileSync(path.join(backups,'.v2.1-backup-complete'),backup);
}
const db=new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,balance_cents INTEGER NOT NULL DEFAULT 0,kind TEXT NOT NULL CHECK(kind IN ('checking','savings','credit')),included INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS envelopes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK(reserved_cents>=0));
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,happened_on TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recurring(id INTEGER PRIMARY KEY,description TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','reserve')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),account_id INTEGER REFERENCES accounts(id),to_account_id INTEGER REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),start_on TEXT NOT NULL,frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','last_business_day','rrq')),active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS account_transfers(id INTEGER PRIMARY KEY,from_account_id INTEGER NOT NULL REFERENCES accounts(id),to_account_id INTEGER NOT NULL REFERENCES accounts(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),description TEXT NOT NULL,happened_on TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recurring_overrides(id INTEGER PRIMARY KEY,recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),UNIQUE(recurring_id,occurrence_on));
`);
// Migration non destructive de la table recurring v0.2 vers v0.3 (préserve les IDs et règles).
const schema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='recurring'").get()?.sql||'';
if(!schema.includes("'last_business_day'")){
 db.exec(`BEGIN;
 ALTER TABLE recurring RENAME TO recurring_v02_backup;
 CREATE TABLE recurring(id INTEGER PRIMARY KEY,description TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','reserve')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),account_id INTEGER REFERENCES accounts(id),to_account_id INTEGER REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),start_on TEXT NOT NULL,frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','last_business_day','rrq')),active INTEGER NOT NULL DEFAULT 1);
 INSERT INTO recurring SELECT * FROM recurring_v02_backup;
 DROP TABLE recurring_v02_backup;
 COMMIT;`);
}
// Migration additive : conserve toutes les règles, transactions et exceptions existantes.
if(!db.prepare('PRAGMA table_info(recurring)').all().some(c=>c.name==='day_adjust')) db.exec("ALTER TABLE recurring ADD COLUMN day_adjust TEXT NOT NULL DEFAULT 'none'");
if(!db.prepare('PRAGMA table_info(transactions)').all().some(c=>c.name==='reviewed')) db.exec('ALTER TABLE transactions ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1))');
// v1.3: additive migration; existing envelope balances and linked transactions are preserved.
for(const [column,definition] of Object.entries({budget_cents:'INTEGER NOT NULL DEFAULT 0',frequency:"TEXT NOT NULL DEFAULT 'none'",start_on:"TEXT",rollover:'INTEGER NOT NULL DEFAULT 0',active:'INTEGER NOT NULL DEFAULT 1'})){
 if(!db.prepare('PRAGMA table_info(envelopes)').all().some(c=>c.name===column))db.exec(`ALTER TABLE envelopes ADD COLUMN ${column} ${definition}`);
}
const q=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
// v1.5 : renouvellements réels et idempotents. La date d'activation empêche
// d'appliquer rétroactivement des renouvellements avant l'installation.
db.exec(`CREATE TABLE IF NOT EXISTS envelope_renewal_log(
 envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
 occurrence_on TEXT NOT NULL, applied_cents INTEGER NOT NULL,
 PRIMARY KEY(envelope_id,occurrence_on));
 CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
// v2.1: liens explicites, additifs; aucune transaction bancaire modifiée.
db.exec(`CREATE TABLE IF NOT EXISTS envelope_budget_overrides(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,budget_cents INTEGER NOT NULL CHECK(budget_cents>=0),PRIMARY KEY(envelope_id,occurrence_on));`);
db.exec(`CREATE TABLE IF NOT EXISTS recurring_moves(recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,new_on TEXT NOT NULL,PRIMARY KEY(recurring_id,occurrence_on));`);
db.exec(`CREATE TABLE IF NOT EXISTS reconciliation_links(
 id INTEGER PRIMARY KEY,
 recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,
 occurrence_on TEXT NOT NULL,
 actual_type TEXT NOT NULL CHECK(actual_type IN ('transaction','transfer')),
 actual_id INTEGER NOT NULL,
 UNIQUE(recurring_id,occurrence_on), UNIQUE(actual_type,actual_id));`);
const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
if(!db.prepare("SELECT value FROM app_settings WHERE key='renewal_activation'").get())
 db.prepare("INSERT INTO app_settings(key,value) VALUES('renewal_activation',?)").run(todayLocal());

const cents=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<100000000?Math.round(v*100):null;
const reply=(r,status,o)=>{if(r.budgetBefore&&status===200){support.recordUndo(r.budgetBefore,r.budgetRoute);if(o.accounts)o.support41=support.state();else if(o.state)o.state.support41=support.state();}r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(o))};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const dateFrom=s=>new Date(s+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10);
const migrationBackup=path.join(dir,'backups','budget-before-v3.sqlite');
if(!db.prepare("SELECT value FROM app_settings WHERE key='features_v3'").get()&&!fs.existsSync(migrationBackup)){
 fs.mkdirSync(path.dirname(migrationBackup),{recursive:true,mode:0o700});
 db.prepare('VACUUM INTO ?').run(migrationBackup);
}
// Extend the CHECK constraint while preserving IDs and every dependent link.
const recurrenceSchema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='recurring'").get().sql;
if(!recurrenceSchema.includes("'quarterly'")){
 const backup=path.join(dir,'backups','budget-before-extended-recurrences.sqlite');
 fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});if(!fs.existsSync(backup))db.prepare('VACUUM INTO ?').run(backup);
 const columns=db.prepare('PRAGMA table_info(recurring)').all().map(c=>'"'+c.name+'"').join(',');
 const replacement=recurrenceSchema.replace(/CREATE TABLE\s+(?:"recurring"|recurring)/i,'CREATE TABLE recurring_extended').replace("'monthly'","'monthly','quarterly','semiannual','yearly'");
 db.exec('PRAGMA foreign_keys=OFF; BEGIN');
 try{db.exec(replacement);db.exec(`INSERT INTO recurring_extended (${columns}) SELECT ${columns} FROM recurring; DROP TABLE recurring; ALTER TABLE recurring_extended RENAME TO recurring;`);if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Liens de récurrence invalides après migration');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.exec('PRAGMA foreign_keys=ON');}
}
const features=createFeatures({db,dir,cents,validDate,today:todayLocal,atomic,addTransaction});
// Additive planning migration; save a coherent copy before changing the schema.
const planningColumns={forecast_account_id:'INTEGER REFERENCES accounts(id)',forecast_spend:'INTEGER NOT NULL DEFAULT 1 CHECK(forecast_spend IN (0,1))',planning_since:'TEXT'};
const existingPlanningColumns=new Set(q('PRAGMA table_info(envelopes)').map(c=>c.name));
if(Object.keys(planningColumns).some(c=>!existingPlanningColumns.has(c))){
 const backup=path.join(dir,'backups','budget-before-planning-v4.sqlite');
 fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});if(!fs.existsSync(backup))db.prepare('VACUUM INTO ?').run(backup);
 atomic(()=>{for(const [column,definition] of Object.entries(planningColumns))if(!existingPlanningColumns.has(column))db.exec(`ALTER TABLE envelopes ADD COLUMN ${column} ${definition}`);run('UPDATE envelopes SET planning_since=? WHERE planning_since IS NULL',todayLocal());});
}
if(!db.prepare('PRAGMA table_info(recurring)').all().some(c=>c.name==='one_time'))db.exec('ALTER TABLE recurring ADD COLUMN one_time INTEGER NOT NULL DEFAULT 0 CHECK(one_time IN (0,1))');
db.exec("CREATE TABLE IF NOT EXISTS envelope_period_status(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','complete','skipped')),PRIMARY KEY(envelope_id,occurrence_on))");
run("INSERT OR IGNORE INTO app_settings(key,value) VALUES('forecast_tracking_since',?)",todayLocal());
// Confirmation links and postponed envelope spending preserve occurrence identity.
if(!db.prepare("SELECT value FROM app_settings WHERE key='planning_actions_v1'").get()){
 const backup=path.join(dir,'backups','budget-before-planning-actions.sqlite');fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});if(!fs.existsSync(backup))db.prepare('VACUUM INTO ?').run(backup);
}
db.exec(`CREATE TABLE IF NOT EXISTS envelope_occurrence_moves(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,new_on TEXT NOT NULL,PRIMARY KEY(envelope_id,occurrence_on));
 CREATE TABLE IF NOT EXISTS envelope_actual_links(transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL);`);
run("INSERT OR IGNORE INTO app_settings(key,value) VALUES('planning_actions_v1','1')");
const planningActions=createPlanningActions({db,snapshot,atomic,addTransaction,validateTransfer,accountEffect,cents,validDate,today:todayLocal});
if(!db.prepare("SELECT value FROM app_settings WHERE key='card_payments_v1'").get()){
 const backup=path.join(dir,'backups','budget-before-card-payments.sqlite');fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});if(!fs.existsSync(backup))db.prepare('VACUUM INTO ?').run(backup);
}
db.exec("CREATE TABLE IF NOT EXISTS card_payment_plans(card_account_id INTEGER PRIMARY KEY REFERENCES accounts(id),recurring_id INTEGER NOT NULL UNIQUE REFERENCES recurring(id) ON DELETE CASCADE,mode TEXT NOT NULL CHECK(mode IN ('purchases','fixed')))");
run("INSERT OR IGNORE INTO app_settings(key,value) VALUES('card_payments_v1','1')");
const cardPayments=createCardPayments({db,cents,validDate,today:todayLocal,atomic});
const freeBudgets=createFreeBudgets({db,atomic,cents,today:todayLocal,exportBackup:features.exportBackup,forecastInput,buildForecast});
const envelopeTools=createEnvelopeTools({db,atomic,cents,validDate,today:todayLocal,exportBackup:features.exportBackup,forecastInput,buildForecast});
const categoryTools=createCategoryTools({db,atomic,exportBackup:features.exportBackup,today:todayLocal});
const dashboardLayout=createDashboardLayout({db,atomic});
const budgetLife=createBudgetLife({db,atomic,cents,validDate,today:todayLocal,exportBackup:features.exportBackup,forecastInput,buildForecast});
const support=createSupport({db,dir,features,today:todayLocal,cents,validDate});
support.dailyBackup();setInterval(()=>support.dailyBackup(),60000).unref();
const featureRoutes=new Set(['/api/categories','/api/categories/update','/api/category-budget','/api/goals','/api/goals/delete','/api/balance/reconcile','/api/import/inspect','/api/import/preview','/api/import/commit','/api/backup/validate','/api/backup/restore']);

// Fréquence « dernier jour ouvrable » : lundi à vendredi, sans jours fériés.
// L'ancienne fréquence « rrq » reste acceptée pour conserver les règles existantes.
function lastWeekday(y,m){const d=new Date(Date.UTC(y,m,0,12));while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()-1);return iso(d)}
// Calendrier de jours fériés courants au Québec/Canada, calculé localement.
// Les conventions particulières de chaque institution doivent être vérifiées.
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(y,n-1,day,12))}
function holidaySet(y){const set=new Set();const add=d=>set.add(iso(d));const fixed=(month,day)=>new Date(Date.UTC(y,month-1,day,12));const observed=(month,day)=>{let d=fixed(month,day);if(d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+2);if(d.getUTCDay()===0)d.setUTCDate(d.getUTCDate()+1);add(d)};const nthMonday=(month,n)=>{const d=fixed(month,1);d.setUTCDate(1+(8-d.getUTCDay())%7+(n-1)*7);add(d)};
 observed(1,1);const good=easter(y);good.setUTCDate(good.getUTCDate()-2);add(good);
 const victoria=fixed(5,24);victoria.setUTCDate(24-(victoria.getUTCDay()+6)%7);add(victoria);
 observed(6,24);observed(7,1);nthMonday(9,1);nthMonday(10,2);observed(12,25);observed(12,26);
 return set}
function nonBusiness(date){const d=dateFrom(date);return [0,6].includes(d.getUTCDay())||holidaySet(d.getUTCFullYear()).has(date)}
function shiftDate(date,mode){if(mode==='none')return date;const d=dateFrom(date),step=mode==='before'?-1:1;for(let i=0;i<12&&nonBusiness(iso(d));i++)d.setUTCDate(d.getUTCDate()+step);return iso(d)}
function occurrenceInfo(start,frequency,i,adjust='none'){
 let nominal;
 if(frequency==='last_business_day'||frequency==='rrq'){
  const d=dateFrom(start);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i);
  nominal=lastWeekday(d.getUTCFullYear(),d.getUTCMonth()+1);
 }else nominal=nextOccurrence(start,frequency,i);
 return {date:shiftDate(nominal,adjust),estimated:false,nominal};
}
function nextOccurrence(start,frequency,i){const d=dateFrom(start);if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+i*7);else if(frequency==='biweekly')d.setUTCDate(d.getUTCDate()+i*14);else {const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i*({quarterly:3,semiannual:6,yearly:12}[frequency]||1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}return iso(d)}
// v1.6 : rapprochement conservateur des opérations déjà saisies.
// Ne modifie pas les comptes : les opérations réelles sont déjà reflétées dans leurs soldes.
// Rapproche seulement si compte, montant, description et date concordent sans ambiguïté.
const dayDistance=(a,b)=>Math.abs((dateFrom(a)-dateFrom(b))/86400000);
const words=s=>new Set(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>=3&&!['paiement','virement','facture','prelevement','automatique','vers','pour','compte'].includes(w)));
function similarDescription(a,b){const x=words(a),y=words(b);if(!x.size||!y.size)return false;return [...x].some(w=>y.has(w));}
// Les indicateurs sont prudents : minimum projeté sur la période, pas la somme des mouvements.
// La paie est le prochain revenu récurrent versé dans un compte bancaire inclus.
function spendingWindows(accounts, recurring, days, currentSafe){
 const now=new Date(), weekday=now.getDay();
 const daysUntilSunday=(7-weekday)%7;
 const week=days.slice(0,daysUntilSunday+1);
 const minimum=arr=>Math.min(currentSafe,...arr.map(d=>d.safe_cents));
 let nextPayIndex=-1, payNames=[];
 for(let i=0;i<days.length;i++){
  const payEvents=days[i].events.filter(ev=>ev.type==='income'&&ev.amount_cents>0&&accounts.some(a=>a.id===ev.account_id&&a.included&&a.kind!=='credit'));
  if(payEvents.length){nextPayIndex=i;payNames=payEvents.map(e=>e.description);break}
 }
 // On s'arrête la veille de la paie pour ne pas dépenser prématurément le revenu futur.
 const beforePay=nextPayIndex<0?null:days.slice(0,nextPayIndex);
 return {today_cents:currentSafe,week_cents:minimum(week),week_end:week.at(-1)?.date||null,
  payday_cents:beforePay===null?null:minimum(beforePay),payday_date:nextPayIndex<0?null:days[nextPayIndex].date,
  payday_names:payNames,payday_found:nextPayIndex>=0};
}
function applyEnvelopeRenewals(){
 const today=todayLocal();const activation=db.prepare("SELECT value FROM app_settings WHERE key='renewal_activation'").get().value;
 const envelopes=q("SELECT * FROM envelopes WHERE active=1 AND frequency!='none' AND start_on IS NOT NULL AND budget_cents>0");
 db.exec('BEGIN');try{
 for(const e of envelopes){
  const start=e.start_on>activation?e.start_on:activation;
  if(start>today)continue;
  // Only evaluate dates from activation onward. Max 400 days protects startup time.
  const since=new Date(start+'T12:00:00Z'),end=new Date(today+'T12:00:00Z');
  if((end-since)/86400000>400)continue;
  for(let i=0;i<1500;i++){
   const date=nextOccurrence(e.start_on,e.frequency,i);
   if(date>today)break;
   if(date<start)continue;
   const existing=db.prepare('SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?').get(e.id,date);
   if(existing)continue;
   const current=db.prepare('SELECT reserved_cents FROM envelopes WHERE id=?').get(e.id).reserved_cents;
   const budget=db.prepare('SELECT budget_cents FROM envelope_budget_overrides WHERE envelope_id=? AND occurrence_on=?').get(e.id,date)?.budget_cents??e.budget_cents;
   const updated=e.rollover?current+budget:budget;
   run('UPDATE envelopes SET reserved_cents=? WHERE id=?',updated,e.id);
   run('INSERT INTO envelope_renewal_log(envelope_id,occurrence_on,applied_cents) VALUES(?,?,?)',e.id,date,updated-current);
  }
 }
 db.exec('COMMIT');
 }catch(err){db.exec('ROLLBACK');throw err}
}
function forecastInput(){const accounts=q('SELECT * FROM accounts ORDER BY id DESC'),envelopes=q('SELECT * FROM envelopes ORDER BY id DESC'),recurring=[...q('SELECT * FROM recurring ORDER BY id DESC'),...budgetLife.virtualRules()],overrides=q('SELECT * FROM recurring_overrides ORDER BY occurrence_on,id'),manual=q('SELECT * FROM reconciliation_links'),moves=q('SELECT * FROM recurring_moves'),envelopeOverrides=q('SELECT * FROM envelope_budget_overrides ORDER BY occurrence_on');return {accounts,envelopes,recurring,cardPaymentPlans:q('SELECT * FROM card_payment_plans'),overrides,moves,links:manual,transactions:q('SELECT * FROM transactions'),transfers:q('SELECT * FROM account_transfers'),periods:q('SELECT * FROM envelope_period_status'),envelopeMoves:q('SELECT * FROM envelope_occurrence_moves'),envelopeLinks:q('SELECT * FROM envelope_actual_links'),renewals:q('SELECT * FROM envelope_renewal_log'),envelopeOverrides,today:todayLocal(),since:db.prepare("SELECT value FROM app_settings WHERE key='forecast_tracking_since'").get()?.value||todayLocal(),horizon:90,nextOccurrence,occurrenceInfo,similarDescription};}
function snapshot(){applyEnvelopeRenewals();const accounts=q('SELECT * FROM accounts ORDER BY id DESC'),envelopes=q('SELECT * FROM envelopes ORDER BY id DESC'),recurring=q('SELECT * FROM recurring ORDER BY id DESC'),overrides=q('SELECT * FROM recurring_overrides ORDER BY occurrence_on,id');const cash=accounts.filter(a=>a.kind!=='credit'&&a.included).reduce((s,a)=>s+a.balance_cents,0),reserved=envelopes.reduce((s,e)=>s+e.reserved_cents,0);const manual=q('SELECT * FROM reconciliation_links');
 const envelopeOverrides=q('SELECT * FROM envelope_budget_overrides ORDER BY occurrence_on'),moves=q('SELECT * FROM recurring_moves');
 const simulation=buildForecast(forecastInput());
 for(const row of simulation.rows)row.signature=createHash('sha256').update(JSON.stringify(row)).digest('hex');
 const projected=simulation.days;
 const windows=spendingWindows(accounts,recurring,projected.slice(0,30),cash-reserved);
 const envelopeDetails=envelopes.map(e=>{
  const next=(()=>{if(!e.active||e.frequency==='none'||!e.start_on)return null;for(let i=0;i<1500;i++){const d=nextOccurrence(e.start_on,e.frequency,i);if(d>=todayLocal()&&!q('SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?',e.id,d).length)return d;}return null})();
  const periodStart=(()=>{if(!e.start_on||e.frequency==='none')return null;let last=null;for(let i=0;i<1500;i++){const d=nextOccurrence(e.start_on,e.frequency,i);if(d>todayLocal())break;last=d;}return last})();
  const spent=periodStart===null?0:q('SELECT t.amount_cents FROM transactions t LEFT JOIN envelope_actual_links l ON l.transaction_id=t.id WHERE t.envelope_id=? AND t.happened_on<=? AND t.amount_cents<0 AND ((l.transaction_id IS NOT NULL AND l.occurrence_on=?) OR (l.transaction_id IS NULL AND t.happened_on>=?))',e.id,todayLocal(),periodStart,periodStart).reduce((n,t)=>n-t.amount_cents,0);
  return {id:e.id,spent_cents:spent,available_cents:e.reserved_cents,next_renewal:next,period_start:periodStart};
 });
 const sts_breakdown={credit:[],accounts:accounts.filter(a=>a.kind!=='credit'&&a.included).map(a=>({name:a.name,balance_cents:a.balance_cents})),envelopes:envelopes.filter(e=>e.reserved_cents>0).map(e=>({name:e.name,reserved_cents:e.reserved_cents})),windows:{week_end:windows.week_end,payday_date:windows.payday_date},events:projected.slice(0,30).flatMap(d=>d.events.filter(ev=>ev.sts_impact_cents).map(ev=>({date:d.date,description:ev.description,impact_cents:ev.sts_impact_cents,type:ev.type}))) };return {...features.state(),support41:support.state(),life:budgetLife.state(),dashboard_layout:dashboardLayout.state(),free_budgets:freeBudgets.state(),envelope_insights:envelopeTools.insights(envelopes,envelopeDetails,simulation),card_payment_plans:q('SELECT * FROM card_payment_plans'),planning:{envelope_actual_links:q('SELECT * FROM envelope_actual_links'),rows:simulation.rows,warnings:simulation.warnings,since:simulation.since},calendar_actuals:q('SELECT t.*,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id ORDER BY happened_on,id'),calendar_transfers:q('SELECT * FROM account_transfers ORDER BY happened_on,id'),accounts,envelopes,recurring,overrides,forecast:projected,envelope_details:envelopeDetails,envelope_budget_overrides:envelopeOverrides,sts_breakdown,reconciliation_links:manual,recurring_moves:moves,reconciliation:{matched_count:simulation.rows.filter(r=>r.source==='recurring'&&r.status==='actual').length,method:"Montant, compte, description et date (±3 jours); correspondances ambiguës ignorées"},spending_windows:windows,transfers:q('SELECT t.*,a.name from_name,b.name to_name FROM account_transfers t JOIN accounts a ON a.id=t.from_account_id JOIN accounts b ON b.id=t.to_account_id ORDER BY t.id DESC LIMIT 30'),transactions:q('SELECT t.*,a.name account_name,e.name envelope_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN envelopes e ON e.id=t.envelope_id ORDER BY t.id DESC LIMIT 50'),cash_cents:cash,reserved_cents:reserved,credit_reserved_cents:0,safe_cents:cash-reserved}}
function simulateBudget(x){
 const args=forecastInput(),baseline=buildForecast(args),last=baseline.days.at(-1).date;let scenario;
 if(x.kind==='move'){
  const row=baseline.rows.find(r=>r.key===x.key);
  if(!row||!['planned','pending'].includes(row.status)||!validDate(x.new_on)||x.new_on<args.today||x.new_on>last)throw Error('Choisissez une échéance prévue et une date dans les 90 prochains jours.');
  const list=row.source==='envelope'?'envelopeMoves':'moves',id=row.source==='envelope'?'envelope_id':'recurring_id';
  args[list]=[...args[list].filter(m=>!(m[id]===row[id]&&m.occurrence_on===row.original_on)),{[id]:row[id],occurrence_on:row.original_on,new_on:x.new_on}];
  scenario=buildForecast(args);
 }else if(x.kind==='purchase'){
  const amount=cents(x.amount),account=args.accounts.find(a=>a.id===Number(x.account_id));
  if(!account||amount===null||amount<=0||!validDate(x.date)||x.date<args.today||x.date>last)throw Error('Choisissez un compte, un montant positif et une date dans les 90 prochains jours.');
  args.recurring=[...args.recurring,{id:-1,description:'Simulation · achat supplémentaire',type:'expense',amount_cents:amount,account_id:account.id,start_on:x.date,frequency:'monthly',one_time:1,active:1,day_adjust:'none'}];
  args.similarDescription=(a,b)=>a==='Simulation · achat supplémentaire'?false:similarDescription(a,b);scenario=buildForecast(args);
 }else throw Error('Simulation inconnue.');
 return {baseline:baseline.days,scenario:scenario.days,warnings:scenario.warnings};
}
const staticFiles=new Map([['/','index.html'],['/app.css','app.css'],['/app.js','app.js'],['/features.js','features.js'],['/planner.js','planner.js'],['/transactions.js','transactions.js'],['/forecast-ui.js','forecast-ui.js'],['/planning-workflow.js','planning-workflow.js'],['/card-payments-ui.js','card-payments-ui.js'],['/planning-v4.js','planning-v4.js'],['/planning-v4.css','planning-v4.css'],['/budget-v41.js','budget-v41.js'],['/budget-v41.css','budget-v41.css'],['/free-budgets-ui.js','free-budgets-ui.js'],['/free-budgets.css','free-budgets.css'],['/envelope-v44.js','envelope-v44.js'],['/envelope-v44.css','envelope-v44.css'],['/categories-v46.js','categories-v46.js'],['/categories-v46.css','categories-v46.css'],['/dashboard-v47.js','dashboard-v47.js'],['/dashboard-v47.css','dashboard-v47.css']]);
staticFiles.set('/budget-v50.js','budget-v50.js');staticFiles.set('/budget-v50.css','budget-v50.css');
const mime={'budget-v50.js':'text/javascript; charset=utf-8','budget-v50.css':'text/css; charset=utf-8','index.html':'text/html; charset=utf-8','app.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','features.js':'text/javascript; charset=utf-8','planner.js':'text/javascript; charset=utf-8','transactions.js':'text/javascript; charset=utf-8','forecast-ui.js':'text/javascript; charset=utf-8','planning-workflow.js':'text/javascript; charset=utf-8','card-payments-ui.js':'text/javascript; charset=utf-8','planning-v4.js':'text/javascript; charset=utf-8','planning-v4.css':'text/css; charset=utf-8','budget-v41.js':'text/javascript; charset=utf-8','budget-v41.css':'text/css; charset=utf-8','free-budgets-ui.js':'text/javascript; charset=utf-8','free-budgets.css':'text/css; charset=utf-8','envelope-v44.js':'text/javascript; charset=utf-8','envelope-v44.css':'text/css; charset=utf-8','categories-v46.js':'text/javascript; charset=utf-8','categories-v46.css':'text/css; charset=utf-8','dashboard-v47.js':'text/javascript; charset=utf-8','dashboard-v47.css':'text/css; charset=utf-8'};
function accountEffect(accountId,amount){const kind=db.prepare('SELECT kind FROM accounts WHERE id=?').get(accountId)?.kind;if(!kind)throw Error('Compte introuvable');return kind==='credit'?-amount:amount}
function restoreEnvelope(id,amount,effect=null){if(id&&amount<0)run('UPDATE envelopes SET reserved_cents=reserved_cents+? WHERE id=?',effect??-amount,id)}
function applyEnvelope(id,amount){if(!id||amount>=0)return 0;const effect=Math.min(q('SELECT reserved_cents FROM envelopes WHERE id=?',id)[0].reserved_cents,-amount);run('UPDATE envelopes SET reserved_cents=reserved_cents-? WHERE id=?',effect,id);return effect;}
function validateTransaction(x,old=null){
 const account=Number(x.account_id),envelope=x.envelope_id?Number(x.envelope_id):null,amount=cents(x.amount);
 const description=typeof x.description==='string'?x.description.trim():'';
 if(!Number.isInteger(account)||!db.prepare('SELECT id FROM accounts WHERE id=?').get(account)||amount===null||!amount||!description||description.length>150||!validDate(x.happened_on)||(envelope!==null&&!db.prepare('SELECT id FROM envelopes WHERE id=?').get(envelope))||(envelope!==null&&amount>0))throw Error('Transaction invalide');
 const category=features.categoryId(x.category_id,old&&Number(x.category_id)===old.category_id),subcategory=categoryTools.subcategoryId(x.subcategory_id,category,old&&Number(x.subcategory_id)===old.subcategory_id&&category===old.category_id);
 return {account,envelope,amount,description,date:x.happened_on,category,subcategory};
}
function addTransaction(x,{affectsBalance=true,importBatch=null}={}){
 const t=validateTransaction(x),effect=affectsBalance?applyEnvelope(t.envelope,t.amount):0;
 const result=run('INSERT INTO transactions(account_id,envelope_id,amount_cents,description,happened_on,category_id,subcategory_id,import_batch_id,affects_balance,envelope_effect_cents) VALUES(?,?,?,?,?,?,?,?,?,?)',t.account,t.envelope,t.amount,t.description,t.date,t.category,t.subcategory,importBatch,affectsBalance?1:0,effect);
 if(affectsBalance)run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(t.account,t.amount),t.account);
 return Number(result.lastInsertRowid);
}
function validateTransfer(x){
 const from=Number(x.from_account_id),to=Number(x.to_account_id),amount=cents(x.amount),description=String(x.description||'').trim();
 if(!db.prepare('SELECT id FROM accounts WHERE id=?').get(from)||!db.prepare('SELECT id FROM accounts WHERE id=?').get(to)||from===to||amount===null||amount<=0||!description||description.length>150||!validDate(x.happened_on))throw Error('Virement invalide');
 return {from,to,amount,description,date:x.happened_on};
}
function atomic(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
function detachEnvelopeActual(id){
 const link=db.prepare('SELECT * FROM envelope_actual_links WHERE transaction_id=?').get(id);if(!link)return;
 run('DELETE FROM envelope_actual_links WHERE transaction_id=?',id);
 if(!q('SELECT 1 FROM envelope_actual_links WHERE envelope_id=? AND occurrence_on=?',link.envelope_id,link.occurrence_on).length)run('DELETE FROM envelope_period_status WHERE envelope_id=? AND occurrence_on=?',link.envelope_id,link.occurrence_on);
}
function transactionChange(x,remove=false){
 const id=Number(x.id),old=db.prepare('SELECT * FROM transactions WHERE id=?').get(id);
 if(!old)throw Error('Transaction introuvable');
 const updated=remove?null:validateTransaction({...x,category_id:x.category_id===undefined?old.category_id:x.category_id,subcategory_id:x.subcategory_id===undefined?(x.category_id===undefined||Number(x.category_id)===old.category_id?old.subcategory_id:null):x.subcategory_id},old);
 atomic(()=>{
  if(updated&&old.account_id===updated.account&&old.envelope_id===updated.envelope&&old.amount_cents===updated.amount){
   if(updated.date!==old.happened_on)run("DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",id);
   run('UPDATE transactions SET description=?,happened_on=?,category_id=?,subcategory_id=? WHERE id=?',updated.description,updated.date,updated.category,updated.subcategory,id);return;
  }
  if(old.affects_balance)run('UPDATE accounts SET balance_cents=balance_cents-? WHERE id=?',accountEffect(old.account_id,old.amount_cents),old.account_id);
  restoreEnvelope(old.envelope_id,old.amount_cents,old.envelope_effect_cents);
  if(remove){detachEnvelopeActual(id);run("DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",id);run('DELETE FROM transactions WHERE id=?',id);}
  else{
   if(updated.envelope!==old.envelope_id)detachEnvelopeActual(id);
   if(updated.account!==old.account_id||updated.date!==old.happened_on||updated.envelope!==old.envelope_id||Math.sign(updated.amount)!==Math.sign(old.amount_cents))run("DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",id);
   run('UPDATE transactions SET account_id=?,envelope_id=?,amount_cents=?,description=?,happened_on=? WHERE id=?',updated.account,updated.envelope,updated.amount,updated.description,updated.date,id);
   if(old.affects_balance)run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(updated.account,updated.amount),updated.account);
   const effect=old.affects_balance?applyEnvelope(updated.envelope,updated.amount):0;
   run('UPDATE transactions SET category_id=?,subcategory_id=?,envelope_effect_cents=? WHERE id=?',updated.category,updated.subcategory,effect,id);
  }
 });
}
function transferChange(x,remove=false){
 const id=Number(x.id),old=db.prepare('SELECT * FROM account_transfers WHERE id=?').get(id);
 if(!old)throw Error('Virement introuvable');
 const updated=remove?null:validateTransfer(x);
 atomic(()=>{
  run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',-accountEffect(old.from_account_id,-old.amount_cents),old.from_account_id);
  run('UPDATE accounts SET balance_cents=balance_cents-? WHERE id=?',accountEffect(old.to_account_id,old.amount_cents),old.to_account_id);
  if(remove){run("DELETE FROM reconciliation_links WHERE actual_type='transfer' AND actual_id=?",id);run('DELETE FROM account_transfers WHERE id=?',id);}
  else{
   if(updated.from!==old.from_account_id||updated.to!==old.to_account_id||updated.date!==old.happened_on)run("DELETE FROM reconciliation_links WHERE actual_type='transfer' AND actual_id=?",id);
   run('UPDATE account_transfers SET from_account_id=?,to_account_id=?,amount_cents=?,description=?,happened_on=? WHERE id=?',updated.from,updated.to,updated.amount,updated.description,updated.date,id);
   run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(updated.from,-updated.amount),updated.from);
   run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(updated.to,updated.amount),updated.to);
  }
 });
}
const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
db.function('budget_search',{deterministic:true},normalizeSearch);
function listTransactions(url,all=false){
 const u=new URL(url,'http://localhost'),params=u.searchParams,where=[],args=[];
 if(params.get('search')){where.push("budget_search(t.description) LIKE ? ESCAPE '\\'");args.push('%'+normalizeSearch(params.get('search').slice(0,80)).replace(/[\\%_]/g,c=>'\\'+c)+'%')}
 if(params.get('account')){where.push('t.account_id=?');args.push(Number(params.get('account')))}
 if(params.get('category')){where.push('t.category_id=?');args.push(Number(params.get('category')))}
 if(params.get('subcategory')){where.push('t.subcategory_id=?');args.push(Number(params.get('subcategory')))}
 if(params.get('envelope')){where.push('t.envelope_id=?');args.push(Number(params.get('envelope')))}
 if(params.get('reviewed')==='0'||params.get('reviewed')==='1'){where.push('t.reviewed=?');args.push(Number(params.get('reviewed')))}
 if(params.get('from')&&validDate(params.get('from'))){where.push('t.happened_on>=?');args.push(params.get('from'))}
 if(params.get('to')&&validDate(params.get('to'))){where.push('t.happened_on<=?');args.push(params.get('to'))}
 if(params.get('kind')==='expense'||params.get('kind')==='income')where.push('t.amount_cents'+(params.get('kind')==='expense'?'<':'>')+'0');
 const filter=where.length?' WHERE '+where.join(' AND '):'';
 const totals=db.prepare('SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents ELSE 0 END),0) income_cents,COALESCE(SUM(CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END),0) expense_cents,COALESCE(SUM(CASE WHEN reviewed=0 THEN 1 ELSE 0 END),0) pending_count FROM transactions t'+filter).get(...args);const count=totals.count;
 const page=Math.max(1,Math.min(100000,Number(params.get('page'))||1)),limit=50;
 const rows=db.prepare('SELECT t.*,a.name account_name,e.name envelope_name,c.name category_name,s.name subcategory_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN envelopes e ON e.id=t.envelope_id LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN subcategories s ON s.id=t.subcategory_id'+filter+' ORDER BY t.happened_on DESC,t.id DESC'+(all?'':' LIMIT ? OFFSET ?')).all(...args,...(all?[]:[limit,(page-1)*limit]));
 return {rows,count,page,pages:Math.max(1,Math.ceil(count/limit)),summary:{...totals,net_cents:totals.income_cents-totals.expense_cents}};
}

const handleRequest=async(req,res)=>{try{
res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
if(privateAccess&&req.socket.localPort===privateAccess.port){
 const error=authorizePrivateRequest(req,privateAccess);if(error)return reply(res,403,{error});
}else{
 const expectedHost=`127.0.0.1:${PORT}`,localHost=`localhost:${PORT}`;
 if(![expectedHost,localHost].includes(req.headers.host))return reply(res,403,{error:'Hôte non autorisé.'});
 if(req.method==='POST'&&((req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)||!String(req.headers['content-type']||'').startsWith('application/json')))return reply(res,403,{error:'Requête locale JSON requise.'});
}
if(req.method==='GET'&&req.url==='/api/private/status')return reply(res,200,{version:'5.0.1',data_key:createHash('sha256').update(path.resolve(dir)).digest('hex'),enabled:!!privateAccess,origin:privateAccess?.origin||null,port:privateAccess?.port||null});
if(req.method==='GET'&&req.url.startsWith('/api/support/backup?')){const date=new URL(req.url,'http://localhost').searchParams.get('date'),body=support.dailyFile(date);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="budget-${date}.json"`,'Cache-Control':'no-store'});return res.end(body);}
if(req.method==='GET'&&req.url.startsWith('/api/support/search?'))return reply(res,200,support.search(new URL(req.url,'http://localhost').searchParams.get('q')));
if(req.method==='GET'&&req.url.startsWith('/api/monthly?')){const params=new URL(req.url,'http://localhost').searchParams;return reply(res,200,features.monthly(params.get('month'),params.get('account')));}
if(req.method==='GET'&&req.url==='/api/backup/export'){const backup=features.exportBackup();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="mon-budget-${todayLocal()}.json"`,'Cache-Control':'no-store'});return res.end(JSON.stringify(backup,null,2));}
if(req.method==='GET'&&req.url.startsWith('/api/transactions/export')){
 const rows=listTransactions(req.url,true).rows;
 const text=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
 const lines=[['Date','Description','Compte','Catégorie','Sous-catégorie','Enveloppe','Montant'].map(text).join(';'),...rows.map(r=>[r.happened_on,r.description,r.account_name,r.category_name||'',r.subcategory_name||'',r.envelope_name||''].map(text).join(';')+';'+(r.amount_cents/100).toFixed(2))];
 res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="transactions.csv"','Cache-Control':'no-store'});return res.end('\uFEFF'+lines.join('\r\n'));
}
if(req.method==='GET'&&staticFiles.has(req.url)){const name=staticFiles.get(req.url);res.writeHead(200,{'Content-Type':mime[name],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(new URL('./'+name,import.meta.url)))}
if(req.method==='GET'&&req.url==='/api/reconcile/options')return reply(res,200,{
  actuals:[...q("SELECT id,description,amount_cents,happened_on,account_id,envelope_id,'transaction' actual_type FROM transactions ORDER BY happened_on DESC,id DESC LIMIT 200"),...q("SELECT id,description,amount_cents,happened_on,from_account_id,to_account_id,'transfer' actual_type FROM account_transfers ORDER BY happened_on DESC,id DESC LIMIT 100")],
  links:q('SELECT * FROM reconciliation_links ORDER BY occurrence_on DESC,id DESC')
 });
 if(req.method==='GET'&&req.url.startsWith('/api/transactions/list'))return reply(res,200,listTransactions(req.url));if(req.method==='GET'&&req.url==='/api/state')return reply(res,200,snapshot());
if(req.method!=='POST'||(!featureRoutes.has(req.url)&&!['/api/accounts','/api/accounts/update','/api/accounts/inclusion','/api/envelopes','/api/envelopes/update','/api/envelopes/delete','/api/transactions','/api/transactions/review','/api/transactions/update','/api/transactions/delete','/api/transfers','/api/transfers/update','/api/transfers/delete','/api/recurring','/api/recurring/update','/api/recurring/delete','/api/overrides','/api/overrides/delete','/api/reconcile/link','/api/reconcile/unlink','/api/occurrence/move','/api/occurrence/unmove','/api/envelope/period','/api/envelope/period/delete','/api/envelope/status','/api/planning/action','/api/card-payments','/api/card-payments/delete','/api/simulate','/api/support/reconcile','/api/support/undo','/api/support/backup','/api/support/profiles','/api/support/profiles/delete','/api/support/scenarios','/api/support/scenarios/delete','/api/life/theme','/api/life/cycle','/api/life/review','/api/life/suggest','/api/life/funding-preview','/api/life/funding','/api/life/fund-now','/api/life/cancel-funding','/api/life/rules','/api/life/rules-delete','/api/life/rule-preview','/api/life/rule-apply','/api/life/projects','/api/life/projects-delete','/api/dashboard-layout','/api/categories/merge-preview','/api/categories/merge','/api/categories/archive','/api/subcategories','/api/subcategories/update','/api/subcategories/archive','/api/envelope-tools/preview','/api/envelope-tools/apply','/api/free-budgets/create','/api/free-budgets/starter','/api/free-budgets/adopt','/api/free-budgets/preview','/api/free-budgets/fund','/api/free-budgets/update','/api/free-budgets/delete'].includes(req.url)))return reply(res,404,{error:'Introuvable'});
let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>(featureRoutes.has(req.url)?10_000_000:20000))return reply(res,413,{error:'Requête trop grande'});chunks.push(c)}const x=JSON.parse(Buffer.concat(chunks).toString('utf8')),name=typeof x.name==='string'?x.name.trim():'',exists=(table,id)=>Number.isInteger(id)&&q(`SELECT id FROM ${table} WHERE id=?`,id).length>0;
if(!['/api/life/theme','/api/life/cycle','/api/life/review','/api/life/suggest','/api/life/funding-preview','/api/life/rule-preview','/api/dashboard-layout','/api/categories/merge-preview','/api/envelope-tools/preview','/api/free-budgets/preview','/api/simulate','/api/import/inspect','/api/import/preview','/api/backup/validate','/api/support/reconcile','/api/support/undo','/api/support/backup','/api/support/profiles','/api/support/profiles/delete','/api/support/scenarios','/api/support/scenarios/delete'].includes(req.url)){applyEnvelopeRenewals();res.budgetBefore=features.exportBackup();res.budgetRoute=req.url;}
if(req.url.startsWith('/api/life/')){const result=budgetLife.post(req.url,x);return reply(res,200,result===null?snapshot():result);}
if(req.url==='/api/dashboard-layout'){try{return reply(res,200,{dashboard_layout:dashboardLayout.save(x)});}catch(e){return reply(res,e.code==='LAYOUT_CONFLICT'?409:400,{error:e.message,code:e.code,dashboard_layout:dashboardLayout.state()});}}
if(['/api/categories/merge-preview','/api/categories/merge','/api/categories/archive','/api/subcategories','/api/subcategories/update','/api/subcategories/archive'].includes(req.url)){const result=categoryTools.post(req.url,x);return reply(res,200,req.url.endsWith('/merge-preview')?result:snapshot());}
if(req.url.startsWith('/api/envelope-tools/')){const result=envelopeTools.post(req.url,x);return reply(res,200,req.url.endsWith('/preview')?result:snapshot());}
if(req.url.startsWith('/api/free-budgets/')){const result=freeBudgets.post(req.url,x);return reply(res,200,req.url==='/api/free-budgets/preview'?result:snapshot());}
if(req.url.startsWith('/api/support/')){const result=support.post(req.url,x);return reply(res,200,req.url==='/api/support/reconcile'?result:snapshot());}
if(featureRoutes.has(req.url)){const result=features.post(req.url,x);return reply(res,200,result.changed?snapshot():{...result,...(result.imported||result.safety_backup?{state:snapshot()}:{})});}
if(req.url==='/api/simulate')return reply(res,200,simulateBudget(x));
if(req.url==='/api/card-payments'||req.url==='/api/card-payments/delete'){cardPayments.post(req.url,x);}
else if(req.url==='/api/planning/action'){planningActions.action(x);}
else if(req.url==='/api/accounts/inclusion'){
 const id=Number(x.id);
 if(!exists('accounts',id)||typeof x.included!=='boolean')return reply(res,400,{error:'Sélection de compte invalide'});
 const account=q('SELECT kind FROM accounts WHERE id=?',id)[0];
 if(account.kind==='credit'&&x.included)return reply(res,400,{error:'Un compte de crédit ne peut pas être inclus'});
 run('UPDATE accounts SET included=? WHERE id=?',account.kind==='credit'?0:(x.included?1:0),id);
}
else if(req.url==='/api/accounts/update'){
 const id=Number(x.id),amount=cents(x.balance),included=x.included===true||x.included==='true'?1:0;
 if(!exists('accounts',id)||!name||name.length>80||amount===null||!['checking','savings','credit'].includes(x.kind))return reply(res,400,{error:'Compte invalide'});
 if(x.kind!=='credit'&&q('SELECT 1 FROM card_payment_plans WHERE card_account_id=?',id).length)return reply(res,400,{error:'Retirez le plan de remboursement avant de changer le type de cette carte.'});
 if(x.kind==='credit'&&q('SELECT 1 FROM card_payment_plans p JOIN recurring r ON r.id=p.recurring_id WHERE r.account_id=?',id).length)return reply(res,400,{error:'Ce compte est utilisé pour rembourser une carte.'});
 // A credit account can never be included in spendable cash.
 run('UPDATE accounts SET name=?,balance_cents=?,kind=?,included=? WHERE id=?',name,amount,x.kind,x.kind==='credit'?0:included,id);
}
else if(req.url==='/api/accounts'){const amount=cents(x.balance);if(!name||name.length>80||amount===null||!['checking','savings','credit'].includes(x.kind))return reply(res,400,{error:'Compte invalide'});run('INSERT INTO accounts(name,balance_cents,kind,included) VALUES(?,?,?,?)',name,amount,x.kind,x.kind==='credit'?0:1)}
else if(req.url.startsWith('/api/envelopes')){
 const id=Number(x.id);
 if(req.url.endsWith('/delete')){
  if(!exists('envelopes',id))return reply(res,400,{error:'Enveloppe introuvable'});
  const linked=q('SELECT COUNT(*) AS n FROM transactions WHERE envelope_id=?',id)[0].n+q('SELECT COUNT(*) AS n FROM recurring WHERE envelope_id=?',id)[0].n;
  if(linked)return reply(res,400,{error:'Enveloppe liée à des transactions ou récurrences : supprime ou modifie ces liens avant de supprimer cette enveloppe.'});
  run('DELETE FROM envelopes WHERE id=?',id);
 }else{
  const reserved=cents(x.reserved),budget=cents(x.budget),frequency=x.frequency||'none';
  if(!name||name.length>80||reserved===null||reserved<0||budget===null||budget<0||!['none','weekly','biweekly','monthly'].includes(frequency)||(frequency!=='none'&&(!validDate(x.start_on)||budget<=0))||(req.url.endsWith('/update')&&!exists('envelopes',id)))return reply(res,400,{error:'Enveloppe invalide'});
  const old=req.url.endsWith('/update')?q('SELECT * FROM envelopes WHERE id=?',id)[0]:null;
  const account=x.forecast_account_id===undefined?old?.forecast_account_id??null:x.forecast_account_id?Number(x.forecast_account_id):null;
  if(account!==null&&!exists('accounts',account))return reply(res,400,{error:'Compte de prévision invalide'});
  const values=[name,reserved,budget,frequency,frequency==='none'?null:x.start_on,x.rollover===true?1:0,x.active===false?0:1,account,x.forecast_spend===undefined?old?.forecast_spend??1:x.forecast_spend===false||x.forecast_spend==='false'?0:1];
  if(req.url.endsWith('/update')){run('UPDATE envelopes SET name=?,reserved_cents=?,budget_cents=?,frequency=?,start_on=?,rollover=?,active=?,forecast_account_id=?,forecast_spend=? WHERE id=?',...values,id);}
  else run('INSERT INTO envelopes(name,reserved_cents,budget_cents,frequency,start_on,rollover,active,forecast_account_id,forecast_spend,planning_since) VALUES(?,?,?,?,?,?,?,?,?,?)',...values,todayLocal());
 }
}
else if(req.url==='/api/envelope/status'){
 const id=Number(x.envelope_id),e=q('SELECT * FROM envelopes WHERE id=?',id)[0];
 if(!e||!validDate(x.occurrence_on)||!['open','complete','skipped','auto'].includes(x.status)||e.frequency==='none')return reply(res,400,{error:'Période invalide'});
 let valid=false;for(let i=0;i<20000;i++){const d=nextOccurrence(e.start_on,e.frequency,i);if(d===x.occurrence_on){valid=true;break}if(d>x.occurrence_on)break}
 if(!valid)return reply(res,400,{error:'Date non programmée'});
 if(x.status==='auto')run('DELETE FROM envelope_period_status WHERE envelope_id=? AND occurrence_on=?',id,x.occurrence_on);
 else run('INSERT INTO envelope_period_status(envelope_id,occurrence_on,status) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET status=excluded.status',id,x.occurrence_on,x.status);
}
else if(req.url==='/api/envelope/period'||req.url==='/api/envelope/period/delete'){
 const eid=Number(x.envelope_id),date=x.occurrence_on,e=db.prepare('SELECT * FROM envelopes WHERE id=?').get(eid);
 if(!e||e.frequency==='none'||!e.start_on||!validDate(date)||date<=todayLocal())return reply(res,400,{error:'Période future invalide'});
 let scheduled=false;for(let i=0;i<1500;i++){const d=nextOccurrence(e.start_on,e.frequency,i);if(d===date){scheduled=true;break}if(d>date)break}
 if(!scheduled)return reply(res,400,{error:'Date de renouvellement invalide'});
 if(req.url.endsWith('/delete'))run('DELETE FROM envelope_budget_overrides WHERE envelope_id=? AND occurrence_on=?',eid,date);
 else{const budget=cents(x.budget);if(budget===null||budget<0)return reply(res,400,{error:'Budget invalide'});
 run('INSERT INTO envelope_budget_overrides(envelope_id,occurrence_on,budget_cents) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET budget_cents=excluded.budget_cents',eid,date,budget)}
}
else if(req.url==='/api/occurrence/move'||req.url==='/api/occurrence/unmove'){
 const rid=Number(x.recurring_id),date=x.occurrence_on,rule=db.prepare('SELECT * FROM recurring WHERE id=?').get(rid);
 if(!rule||!validDate(date)||!rule.active)return reply(res,400,{error:'Récurrence ou date invalide'});
 let scheduled=false;for(let i=0;i<(rule.one_time?1:20000);i++){const d=occurrenceInfo(rule.start_on,rule.frequency,i,rule.day_adjust||'none').date;if(d===date){scheduled=true;break}if(d>date)break}
 if(!scheduled)return reply(res,400,{error:'Occurrence introuvable'});
 if(req.url.endsWith('unmove'))run('DELETE FROM recurring_moves WHERE recurring_id=? AND occurrence_on=?',rid,date);
 else{
  if(!validDate(x.new_on)||x.new_on<todayLocal()||dayDistance(x.new_on,date)>90)return reply(res,400,{error:'Nouvelle date invalide (90 jours maximum)'});
  run('INSERT INTO recurring_moves(recurring_id,occurrence_on,new_on) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET new_on=excluded.new_on',rid,date,x.new_on);
 }
}
else if(req.url==='/api/reconcile/link'){
 const rid=Number(x.recurring_id),date=x.occurrence_on,kind=x.actual_type,id=Number(x.actual_id);
 const rule=db.prepare('SELECT * FROM recurring WHERE id=?').get(rid);
 const actual=kind==='transaction'?db.prepare('SELECT * FROM transactions WHERE id=?').get(id):kind==='transfer'?db.prepare('SELECT * FROM account_transfers WHERE id=?').get(id):null;
 if(!rule||!actual||!validDate(date)||rule.type==='reserve'||!rule.active||!Number.isSafeInteger(id)||id<1)return reply(res,400,{error:'Rapprochement invalide'});
 let validOccurrence=false;for(let i=0;i<(rule.one_time?1:20000);i++){const d=occurrenceInfo(rule.start_on,rule.frequency,i,rule.day_adjust||'none').date;if(d===date){validOccurrence=true;break}if(d>date)break}
 if(!validOccurrence||dayDistance(date,actual.happened_on)>31)return reply(res,400,{error:'Occurrence ou date incompatible'});
 if(kind==='transaction'&&(rule.type==='transfer'||rule.account_id!==actual.account_id||(rule.type==='expense'&&actual.amount_cents>=0)||(rule.type==='income'&&actual.amount_cents<=0)))return reply(res,400,{error:'Compte ou type incompatible'});
 if(kind==='transfer'&&(rule.type!=='transfer'||rule.account_id!==actual.from_account_id||rule.to_account_id!==actual.to_account_id))return reply(res,400,{error:'Comptes incompatibles'});
 if(kind==='transaction'&&db.prepare('SELECT 1 FROM envelope_actual_links WHERE transaction_id=?').get(id))return reply(res,400,{error:'Cette opération est déjà associée à une période d’enveloppe.'});
 // Une opération réelle et une occurrence ne peuvent être liées qu'une seule fois.
 run('INSERT INTO reconciliation_links(recurring_id,occurrence_on,actual_type,actual_id) VALUES(?,?,?,?)',rid,date,kind,id);
}
else if(req.url==='/api/reconcile/unlink'){
 const id=Number(x.id);if(!Number.isSafeInteger(id)||!db.prepare('SELECT 1 FROM reconciliation_links WHERE id=?').get(id))return reply(res,400,{error:'Lien introuvable'});
 run('DELETE FROM reconciliation_links WHERE id=?',id);
}
else if(req.url==='/api/transactions/update'||req.url==='/api/transactions/delete'){transactionChange(x,req.url.endsWith('/delete'))}
else if(req.url==='/api/transfers/update'||req.url==='/api/transfers/delete'){transferChange(x,req.url.endsWith('/delete'))}
else if(req.url==='/api/transactions/review'){const id=Number(x.id);if(!exists('transactions',id)||typeof x.reviewed!=='boolean')return reply(res,400,{error:'Statut de transaction invalide'});run('UPDATE transactions SET reviewed=? WHERE id=?',x.reviewed?1:0,id)}
else if(req.url==='/api/transfers'){const amount=cents(x.amount),from=Number(x.from_account_id),to=Number(x.to_account_id),description=typeof x.description==='string'?x.description.trim():'';if(!exists('accounts',from)||!exists('accounts',to)||from===to||amount===null||amount<=0||!description||description.length>150||!validDate(x.happened_on))return reply(res,400,{error:'Virement invalide'});const f=q('SELECT kind FROM accounts WHERE id=?',from)[0],t=q('SELECT kind FROM accounts WHERE id=?',to)[0];db.exec('BEGIN');try{run('INSERT INTO account_transfers(from_account_id,to_account_id,amount_cents,description,happened_on) VALUES(?,?,?,?,?)',from,to,amount,description,x.happened_on);run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',f.kind==='credit'?amount:-amount,from);run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',t.kind==='credit'?-amount:amount,to);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
else if(req.url==='/api/transactions'){atomic(()=>addTransaction(x))}
else if(req.url==='/api/overrides'||req.url==='/api/overrides/delete'){const id=Number(x.id);if(req.url.endsWith('/delete')){if(!exists('recurring_overrides',id))return reply(res,400,{error:'Exception introuvable'});run('DELETE FROM recurring_overrides WHERE id=?',id)}else{const rid=Number(x.recurring_id),amount=cents(x.amount),date=x.occurrence_on;if(!exists('recurring',rid)||!validDate(date)||amount===null||amount<0)return reply(res,400,{error:'Exception invalide'});const rule=q('SELECT * FROM recurring WHERE id=?',rid)[0];let scheduled=false;for(let i=0;i<(rule.one_time?1:20000);i++){const next=occurrenceInfo(rule.start_on,rule.frequency,i,rule.day_adjust||'none').date;if(next===date){scheduled=true;break}if(next>date)break}if(!scheduled)return reply(res,400,{error:'Cette date ne correspond pas à une occurrence prévue de la règle'});run('INSERT INTO recurring_overrides(recurring_id,occurrence_on,amount_cents) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET amount_cents=excluded.amount_cents',rid,date,amount)}}
else {const id=Number(x.id);if(req.url==='/api/recurring/delete'){if(!exists('recurring',id))return reply(res,400,{error:'Règle introuvable'});run('DELETE FROM recurring WHERE id=?',id)}else{const amount=cents(x.amount),account=Number(x.account_id),to=x.to_account_id?Number(x.to_account_id):null,envelope=x.envelope_id?Number(x.envelope_id):null,description=typeof x.description==='string'?x.description.trim():'';if(!description||description.length>150||!['income','expense','transfer','reserve'].includes(x.type)||!['weekly','biweekly','monthly','quarterly','semiannual','yearly','last_business_day','rrq'].includes(x.frequency)||!['none','before','after'].includes(x.day_adjust??'none')||!validDate(x.start_on)||amount===null||amount<=0||(x.type!=='reserve'&&!exists('accounts',account))||(x.type==='transfer'&&(!exists('accounts',to)||to===account))||((x.type==='reserve'||(x.type==='expense'&&envelope!==null))&&!exists('envelopes',envelope))||(req.url.endsWith('update')&&!exists('recurring',id)))return reply(res,400,{error:'Règle récurrente invalide'});
if(x.type==='transfer'&&x.active!==false&&q('SELECT 1 FROM card_payment_plans WHERE card_account_id=? AND recurring_id!=?',to,id||0).length)return reply(res,400,{error:'Un plan de remboursement existe déjà pour cette carte. Modifiez ce plan pour éviter deux paiements prévus.'});
const paymentPlan=q('SELECT * FROM card_payment_plans WHERE recurring_id=?',id)[0];if(paymentPlan&&(x.type!=='transfer'||to!==paymentPlan.card_account_id||q('SELECT kind FROM accounts WHERE id=?',account)[0]?.kind==='credit'||!['weekly','biweekly','monthly'].includes(x.frequency)||(x.day_adjust||'none')!=='none'||x.one_time===true||x.one_time===1||x.one_time==='true'))return reply(res,400,{error:'Modifiez ce remboursement depuis le réglage de la carte.'});
const fields=[description,x.type,amount,x.type==='reserve'?null:account,x.type==='transfer'?to:null,['reserve','expense'].includes(x.type)?envelope:null,x.start_on,x.frequency,x.active===false?0:1,x.day_adjust||'none',x.one_time===true||x.one_time===1||x.one_time==='true'?1:0];if(req.url.endsWith('update'))run('UPDATE recurring SET description=?,type=?,amount_cents=?,account_id=?,to_account_id=?,envelope_id=?,start_on=?,frequency=?,active=?,day_adjust=?,one_time=? WHERE id=?',...fields,id);else run('INSERT INTO recurring(description,type,amount_cents,account_id,to_account_id,envelope_id,start_on,frequency,active,day_adjust,one_time) VALUES(?,?,?,?,?,?,?,?,?,?,?)',...fields)}}
return reply(res,200,snapshot())}catch(e){console.error(e);return reply(res,400,{error:(featureRoutes.has(req.url)||req.url==='/api/planning/action'||req.url==='/api/simulate'||req.url.startsWith('/api/support/')||req.url.startsWith('/api/free-budgets/')||req.url.startsWith('/api/life/')||req.url.startsWith('/api/subcategories')||req.url.startsWith('/api/categories/')||req.url.startsWith('/api/envelope-tools/')||req.url.startsWith('/api/card-payments'))?(String(e.message).includes('UNIQUE constraint')?'Ce nom existe déjà.':e.message):'Données invalides'})}};
http.createServer(handleRequest).listen(PORT,HOST,()=>console.log(`Mon Budget v5.0.1 : http://${HOST}:${PORT}`));
if(privateAccess)http.createServer(handleRequest).listen(privateAccess.port,HOST,()=>console.log('Accès privé : backend Tailscale prêt sur l’interface locale.'));
