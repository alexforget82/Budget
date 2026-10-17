import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export function parseCSV(text, delimiter) {
  if(typeof text!=='string'||Buffer.byteLength(text)>2_000_000)throw Error('CSV trop volumineux (2 Mo maximum).');
  text=text.replace(/^\uFEFF/,'');
  if(!delimiter){
    const first=text.split(/\r?\n/)[0];
    delimiter=[',',';','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  }
  if(![',',';','\t'].includes(delimiter))throw Error('Séparateur CSV invalide.');
  const rows=[];let row=[],value='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;}
    else if(c==='"'&&!value&&!closed)quoted=true;
    else if(c===delimiter){row.push(value);value='';closed=false;}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';closed=false;}
    else{if(closed&&!/\s/.test(c))throw Error('Guillemets CSV invalides.');value+=c;}
    if(rows.length>2001||value.length>10000||row.length>60)throw Error('CSV limité à 2 000 opérations et 60 colonnes.');
  }
  if(quoted)throw Error('Guillemets CSV non fermés.');
  row.push(value);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2||rows.length>2001||rows[0].length>60)throw Error('Le CSV doit contenir une ligne de titres et de 1 à 2 000 opérations.');
  return {headers:rows[0].map(v=>v.trim()),rows:rows.slice(1),delimiter};
}

export function bankAmount(value){
  let text=String(value??'').trim().replace(/CAD|USD|\$/gi,'').replace(/[\s\u00a0\u202f]/g,'');
  if(!text)return null;
  if(/^\(.*\)$/.test(text))text='-'+text.slice(1,-1);
  if(/^[\d.,]+-$/.test(text))text='-'+text.slice(0,-1);
  if(!/^[+-]?\d[\d.,]*$/.test(text))throw Error('Montant invalide.');
  if(text.includes(',')&&text.includes('.')){const decimal=text.lastIndexOf(',')>text.lastIndexOf('.')?',':'.';text=text.split(decimal==='.'?',':'.').join('').replace(decimal,'.');}
  else if(text.includes(',')){text=/,\d{3}$/.test(text)?text.replaceAll(',',''):text.replace(',','.');}
  const amount=Number(text);if(!Number.isFinite(amount)||Math.abs(amount)>=100000000||Math.abs(amount*100-Math.round(amount*100))>.0001)throw Error('Montant invalide (deux décimales maximum).');
  return Math.round(amount*100);
}

const tables=['accounts','envelopes','categories','subcategories','import_batches','transactions','recurring','account_transfers','recurring_overrides','envelope_renewal_log','app_settings','envelope_budget_overrides','recurring_moves','reconciliation_links','category_budgets','goals','balance_reconciliations','envelope_period_status','envelope_occurrence_moves','envelope_actual_links','card_payment_plans'];
const categoryDefaults=['Épicerie','Logement','Transport','Restaurants','Santé','Loisirs','Abonnements','Achats','Revenus','Autres'];

export function createFeatures({db,dir,cents,validDate,today,atomic,addTransaction}){
  const q=(sql,...values)=>db.prepare(sql).all(...values),run=(sql,...values)=>db.prepare(sql).run(...values);
  db.exec(`CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS import_batches(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,account_id INTEGER NOT NULL REFERENCES accounts(id),affects_balance INTEGER NOT NULL CHECK(affects_balance IN (0,1)),imported_count INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS category_budgets(category_id INTEGER PRIMARY KEY REFERENCES categories(id),limit_cents INTEGER NOT NULL CHECK(limit_cents>=0));
    CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY,name TEXT NOT NULL,target_cents INTEGER NOT NULL CHECK(target_cents>0),saved_cents INTEGER NOT NULL DEFAULT 0 CHECK(saved_cents>=0),target_date TEXT);
    CREATE TABLE IF NOT EXISTS balance_reconciliations(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),old_balance_cents INTEGER NOT NULL,new_balance_cents INTEGER NOT NULL,happened_on TEXT NOT NULL,note TEXT NOT NULL);`);
  if(!q('PRAGMA table_info(categories)').some(c=>c.name==='archived')){if(q('SELECT id FROM accounts LIMIT 1').length){const file=path.join(dir,'backups','budget-before-v4.6.sqlite');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});if(!fs.existsSync(file))db.prepare('VACUUM INTO ?').run(file);}db.exec('ALTER TABLE categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))');}
  db.exec('CREATE TABLE IF NOT EXISTS subcategories(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL REFERENCES categories(id),name TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),UNIQUE(category_id,name COLLATE NOCASE))');
  const existing=new Set(q('PRAGMA table_info(transactions)').map(c=>c.name));
  for(const [name,definition] of Object.entries({subcategory_id:'INTEGER REFERENCES subcategories(id)',category_id:'INTEGER REFERENCES categories(id)',import_batch_id:'INTEGER REFERENCES import_batches(id)',affects_balance:'INTEGER NOT NULL DEFAULT 1 CHECK(affects_balance IN (0,1))',envelope_effect_cents:'INTEGER'}))if(!existing.has(name))db.exec(`ALTER TABLE transactions ADD COLUMN ${name} ${definition}`);
  if(!q("SELECT value FROM app_settings WHERE key='features_v3'").length)atomic(()=>{for(const name of categoryDefaults)run('INSERT OR IGNORE INTO categories(name) VALUES(?)',name);run("INSERT INTO app_settings(key,value) VALUES('features_v3','1')");});

  const categoryId=(value,allowArchived=false)=>{if(value===null||value===undefined||value==='')return null;const id=Number(value);if(!Number.isSafeInteger(id)||!q('SELECT id FROM categories WHERE id=? AND (? OR archived=0)',id,allowArchived?1:0).length)throw Error('Catégorie introuvable.');return id;};
  const exportBackup=()=>({format:'mon-budget',version:1,created_at:new Date().toISOString(),tables:Object.fromEntries(tables.map(table=>[table,q(`SELECT * FROM ${table}`)]))});
  function saveBackup(){const backupDir=path.join(dir,'backups');fs.mkdirSync(backupDir,{recursive:true,mode:0o700});const name='budget-'+Date.now()+'-'+Math.random().toString(16).slice(2)+'.json';fs.writeFileSync(path.join(backupDir,name),JSON.stringify(exportBackup()),{mode:0o600,flag:'wx'});return name;}
  function normalizeBackup(backup){
    const result=structuredClone(backup);
    if(result?.format!=='mon-budget'||result.version!==1||!result.tables)return result;
    const legacy=!Object.hasOwn(result.tables,'envelope_period_status')&&Array.isArray(result.tables.app_settings)&&!result.tables.app_settings.some(s=>s.key==='forecast_tracking_since')&&Array.isArray(result.tables.envelopes)&&result.tables.envelopes.every(e=>!Object.hasOwn(e,'forecast_account_id'))&&Array.isArray(result.tables.recurring)&&result.tables.recurring.every(r=>!Object.hasOwn(r,'one_time'));
    if(legacy){
    result.tables.envelope_period_status=[];
    for(const row of result.tables.envelopes||[]){if(!Object.hasOwn(row,'forecast_account_id'))row.forecast_account_id=null;if(!Object.hasOwn(row,'forecast_spend'))row.forecast_spend=1;if(!Object.hasOwn(row,'planning_since'))row.planning_since=today();}
    for(const row of result.tables.recurring||[])if(!Object.hasOwn(row,'one_time'))row.one_time=0;
    if(Array.isArray(result.tables.app_settings)&&!result.tables.app_settings.some(s=>s.key==='forecast_tracking_since'))result.tables.app_settings.push({key:'forecast_tracking_since',value:today()});
    }
    const oldActions=Array.isArray(result.tables.app_settings)&&!result.tables.app_settings.some(s=>s.key==='planning_actions_v1')&&!Object.hasOwn(result.tables,'envelope_occurrence_moves')&&!Object.hasOwn(result.tables,'envelope_actual_links');
    if(oldActions){result.tables.envelope_occurrence_moves=[];result.tables.envelope_actual_links=[];result.tables.app_settings.push({key:'planning_actions_v1',value:'1'});}
    const oldCards=Array.isArray(result.tables.app_settings)&&!result.tables.app_settings.some(s=>s.key==='card_payments_v1')&&!Object.hasOwn(result.tables,'card_payment_plans');
    if(oldCards){result.tables.card_payment_plans=[];result.tables.app_settings.push({key:'card_payments_v1',value:'1'});}
    if(!Object.hasOwn(result.tables,'subcategories')){result.tables.subcategories=[];for(const c of result.tables.categories||[])if(!Object.hasOwn(c,'archived'))c.archived=0;for(const t of result.tables.transactions||[])if(!Object.hasOwn(t,'subcategory_id'))t.subcategory_id=null;}
    return result;
  }
  function validateBackup(backup){
    backup=normalizeBackup(backup);
    if(!backup||backup.format!=='mon-budget'||backup.version!==1||!backup.tables||typeof backup.tables!=='object'||Object.keys(backup.tables).sort().join()!==[...tables].sort().join())throw Error('Sauvegarde Mon Budget incompatible ou incomplète.');
    const stage=new DatabaseSync(':memory:');let count=0;
    try{
      stage.exec('PRAGMA foreign_keys=ON;');
      for(const table of tables)stage.exec(q("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",table)[0].sql);
      stage.exec('BEGIN; PRAGMA defer_foreign_keys=ON;');
      for(const table of tables){
        const rows=backup.tables[table],columns=q(`PRAGMA table_info(${table})`);if(!Array.isArray(rows)||(count+=rows.length)>100000)throw Error('Sauvegarde trop volumineuse.');
        const insert=stage.prepare(`INSERT INTO ${table}(${columns.map(c=>c.name).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
        for(const row of rows){
          if(!row||typeof row!=='object'||Object.keys(row).sort().join()!==columns.map(c=>c.name).sort().join())throw Error('Colonnes de sauvegarde incompatibles.');
          for(const c of columns){const value=row[c.name];if(value===null){if(c.notnull||c.pk)throw Error('Valeur requise manquante.');continue;}
            if(c.type==='INTEGER'&&(!Number.isSafeInteger(value)||Math.abs(value)>1e12))throw Error('Nombre de sauvegarde invalide.');
            if(c.type==='TEXT'&&(typeof value!=='string'||value.length>(table==='app_settings'?100000:10000)))throw Error('Texte de sauvegarde invalide.');
            if((c.name.endsWith('_on')||['target_date','next_renewal'].includes(c.name))&&!validDate(value))throw Error('Date de sauvegarde invalide.');
            if(c.name==='id'&&value<1)throw Error('Identifiant invalide.');
          }
          insert.run(...columns.map(c=>row[c.name]));
        }
      }
      if(stage.prepare('PRAGMA foreign_key_check').all().length)throw Error('Liens invalides dans la sauvegarde.');
      const childNames=new Set();for(const sub of stage.prepare('SELECT * FROM subcategories').all()){const key=JSON.stringify([sub.category_id,sub.name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA').replace(/\s+/g,' ').trim()]);if(childNames.has(key))throw Error('Sous-catégories en double dans une catégorie.');childNames.add(key);}
      if(stage.prepare('SELECT t.id FROM transactions t JOIN subcategories s ON s.id=t.subcategory_id WHERE t.category_id IS NULL OR t.category_id!=s.category_id').all().length)throw Error('Sous-catégorie incompatible avec la catégorie de la transaction.');
      if(stage.prepare('SELECT id FROM transactions WHERE amount_cents=0 OR (amount_cents>0 AND envelope_id IS NOT NULL) OR envelope_effect_cents<0').all().length)throw Error('Transaction de sauvegarde invalide.');
      if(stage.prepare("SELECT id FROM accounts WHERE kind='credit' AND included!=0").all().length)throw Error('Compte de crédit invalide.');
      if(stage.prepare("SELECT id FROM recurring WHERE (type!='reserve' AND account_id IS NULL) OR (type='transfer' AND (to_account_id IS NULL OR to_account_id=account_id)) OR (type='reserve' AND envelope_id IS NULL)").all().length)throw Error('Règle récurrente invalide.');
      for(const link of stage.prepare('SELECT * FROM reconciliation_links').all()){const table=link.actual_type==='transaction'?'transactions':'account_transfers';if(!stage.prepare(`SELECT id FROM ${table} WHERE id=?`).get(link.actual_id))throw Error('Rapprochement invalide.');}
      for(const link of stage.prepare('SELECT * FROM envelope_actual_links').all()){
       const t=stage.prepare('SELECT * FROM transactions WHERE id=?').get(link.transaction_id);
       if(!t||t.amount_cents>=0||t.envelope_id!==link.envelope_id||stage.prepare("SELECT 1 FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?").get(link.transaction_id))throw Error('Association d’enveloppe invalide.');
      }
      for(const p of stage.prepare('SELECT p.*,r.type,r.to_account_id,r.frequency,r.one_time,r.day_adjust,a.kind card_kind,b.kind source_kind FROM card_payment_plans p JOIN recurring r ON r.id=p.recurring_id JOIN accounts a ON a.id=p.card_account_id LEFT JOIN accounts b ON b.id=r.account_id').all())if(p.type!=='transfer'||p.to_account_id!==p.card_account_id||p.card_kind!=='credit'||p.source_kind==='credit'||!['weekly','biweekly','monthly'].includes(p.frequency)||p.one_time||p.day_adjust!=='none')throw Error('Plan de remboursement invalide.');
      if(stage.prepare("SELECT p.card_account_id FROM card_payment_plans p JOIN recurring r ON r.to_account_id=p.card_account_id WHERE r.type='transfer' AND r.active=1 AND r.id!=p.recurring_id").all().length)throw Error('Plusieurs remboursements actifs pour la même carte.');
      const activation=stage.prepare("SELECT value FROM app_settings WHERE key='renewal_activation'").get();if(!activation||!validDate(activation.value)||stage.prepare("SELECT value FROM app_settings WHERE key='features_v3'").get()?.value!=='1')throw Error('Paramètres de sauvegarde invalides.');
      stage.exec('COMMIT');return Object.fromEntries(tables.map(t=>[t,backup.tables[t].length]));
    }catch(e){if(/constraint|datatype mismatch/i.test(e.message))throw Error('Sauvegarde invalide : des valeurs ou des liens sont incompatibles.');throw e;}finally{stage.close();}
  }
  function restore(backup){
    backup=normalizeBackup(backup);validateBackup(backup);const filename=saveBackup();
    atomic(()=>{db.exec('PRAGMA defer_foreign_keys=ON');for(const t of [...tables].reverse())run(`DELETE FROM ${t}`);for(const t of tables){const cols=q(`PRAGMA table_info(${t})`).map(c=>c.name),stmt=db.prepare(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`);for(const row of backup.tables[t])stmt.run(...cols.map(c=>row[c]));}if(q('PRAGMA foreign_key_check').length)throw Error('Sauvegarde incohérente.');});
    return {safety_backup:filename};
  }
  function monthly(month,account){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mois invalide.');
    const conditions=['substr(t.happened_on,1,7)=?'],values=[month];if(account){conditions.push('t.account_id=?');values.push(Number(account));}
    const filter=conditions.join(' AND ');
    const totals=q(`SELECT COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents ELSE 0 END),0) income_cents,COALESCE(SUM(CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END),0) expense_cents,COUNT(*) count FROM transactions t WHERE ${filter}`,...values)[0];
    const groups=q(`SELECT t.category_id,COALESCE(c.name,'Non classé') name,SUM(-t.amount_cents) expense_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE ${filter} AND t.amount_cents<0 GROUP BY t.category_id ORDER BY expense_cents DESC`,...values);
    const budgets=q('SELECT c.id,c.name,b.limit_cents FROM categories c LEFT JOIN category_budgets b ON b.category_id=c.id ORDER BY c.name');
    const subgroups=q(`SELECT t.category_id,t.subcategory_id,COALESCE(s.name,'Sans sous-catégorie') name,SUM(-t.amount_cents) expense_cents FROM transactions t LEFT JOIN subcategories s ON s.id=t.subcategory_id WHERE ${filter} AND t.amount_cents<0 GROUP BY t.category_id,t.subcategory_id ORDER BY expense_cents DESC`,...values);
    return {month,...totals,net_cents:totals.income_cents-totals.expense_cents,groups,subgroups,budgets};
  }
  function preview(x){
    const account=Number(x.account_id);if(!q('SELECT id FROM accounts WHERE id=?',account).length)throw Error('Choisissez un compte.');
    const parsed=parseCSV(x.csv,x.delimiter),map=x.mapping||{};
    const column=name=>{const n=Number(map[name]);if(map[name]===''||map[name]===null||map[name]===undefined)return null;if(!Number.isInteger(n)||n<0||n>=parsed.headers.length)throw Error('Correspondance de colonne invalide.');return n;};
    const cols=Object.fromEntries(['date','description','amount','debit','credit','category','subcategory'].map(k=>[k,column(k)]));
    if(cols.date===null||cols.description===null||(cols.amount===null&&cols.debit===null&&cols.credit===null))throw Error('Associez date, description et montant (ou débit/crédit).');
    const category=categoryId(x.category_id),sub=x.subcategory_id?Number(x.subcategory_id):null;
    if(sub&&!q('SELECT s.id FROM subcategories s JOIN categories c ON c.id=s.category_id WHERE s.id=? AND s.category_id=? AND s.archived=0 AND c.archived=0',sub,category).length)throw Error('Sous-catégorie d’import invalide.');
    const seen=new Set(q('SELECT happened_on,description,amount_cents FROM transactions WHERE account_id=?',account).map(r=>JSON.stringify([r.happened_on,r.description.trim().toLowerCase(),r.amount_cents])));
    const categories=new Map(q('SELECT * FROM categories WHERE archived=0').map(c=>[c.name.toLowerCase(),c.id]));
    const rows=parsed.rows.map((row,index)=>{
      try{
        if(row.length!==parsed.headers.length)throw Error('Nombre de colonnes différent des titres.');
        let date=row[cols.date].trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){const m=date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(!m||!['DMY','MDY'].includes(x.date_format))throw Error('Date ambiguë : choisissez jour/mois ou mois/jour.');date=m[3]+'-'+(x.date_format==='DMY'?m[2]:m[1]).padStart(2,'0')+'-'+(x.date_format==='DMY'?m[1]:m[2]).padStart(2,'0');}
        if(!validDate(date))throw Error('Date invalide.');
        const description=row[cols.description].trim();if(!description||description.length>150)throw Error('Description requise (150 caractères maximum).');
        let amount;
        if(cols.amount!==null)amount=bankAmount(row[cols.amount]);
        else{const debit=cols.debit===null?0:bankAmount(row[cols.debit])||0,credit=cols.credit===null?0:bankAmount(row[cols.credit])||0;if(debit<0||credit<0||(debit&&credit))throw Error('Débit et crédit doivent être positifs et distincts.');amount=credit-debit;}
        if(x.invert_sign===true)amount=-amount;if(!amount)throw Error('Montant nul ou manquant.');
        const key=JSON.stringify([date,description.toLowerCase(),amount]),duplicate=seen.has(key);seen.add(key);
        const resolved=cols.category===null?category:categories.get(row[cols.category].trim().toLowerCase())??category;let child=resolved===category?sub:null;if(cols.subcategory!==null&&row[cols.subcategory].trim()){const name=row[cols.subcategory].trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA');child=q('SELECT * FROM subcategories WHERE category_id=? AND archived=0',resolved).find(s=>s.name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA')===name)?.id;if(!child)throw Error('Sous-catégorie inconnue pour cette catégorie.');}return {row:index+1,date,description,amount_cents:amount,category_id:resolved,subcategory_id:child,duplicate};
      }catch(e){return {row:index+1,error:e.message};}
    });
    return {...parsed,rows,fingerprint:createHash('sha256').update(JSON.stringify([x.csv,x.delimiter,x.mapping,x.account_id,x.date_format,x.category_id,x.subcategory_id,x.invert_sign,x.affects_balance])).digest('hex')};
  }
  function importCSV(x){
    const result=preview(x);if(result.fingerprint!==x.fingerprint)throw Error('Le fichier ou les options ont changé. Recommencez l’aperçu.');
    if(!Array.isArray(x.selected_rows)||!x.selected_rows.length||x.selected_rows.length>2000||new Set(x.selected_rows).size!==x.selected_rows.length)throw Error('Sélectionnez les opérations à importer.');
    const rows=x.selected_rows.map(n=>result.rows.find(row=>row.row===n));if(rows.some(r=>!r||r.error||(r.duplicate&&x.include_duplicates!==true)))throw Error('La sélection contient une erreur ou un doublon non autorisé.');
    let batch;
    atomic(()=>{batch=run('INSERT INTO import_batches(created_at,account_id,affects_balance,imported_count) VALUES(?,?,?,?)',new Date().toISOString(),Number(x.account_id),x.affects_balance===true?1:0,rows.length).lastInsertRowid;for(const r of rows)addTransaction({account_id:x.account_id,description:r.description,amount:r.amount_cents/100,happened_on:r.date,category_id:r.category_id,subcategory_id:r.subcategory_id}, {affectsBalance:x.affects_balance===true,importBatch:Number(batch)});});
    return {imported:rows.length,batch_id:Number(batch)};
  }
  function post(route,x){
    if(route==='/api/categories'||route==='/api/categories/update'){
      const name=typeof x.name==='string'?x.name.trim():'';
      if(!name||name.length>60)throw Error('Nom de catégorie requis (60 caractères maximum).');
      const id=route.endsWith('/update')?categoryId(x.id,true):null;
      if(route.endsWith('/update')&&!id)throw Error('Catégorie introuvable.');
      if(id&&x.expected_name!==q('SELECT name FROM categories WHERE id=?',id)[0].name)throw Error('Cette catégorie a changé. Actualisez avant de la renommer.');
      const normalized=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA').replace(/\s+/g,' ').trim();
      if(q('SELECT * FROM categories').some(c=>c.id!==id&&normalized(c.name)===normalized(name)))throw Error('Une catégorie porte déjà ce nom.');
      if(id)run('UPDATE categories SET name=? WHERE id=?',name,id);else run('INSERT INTO categories(name) VALUES(?)',name);
    }
    else if(route==='/api/category-budget'){const id=categoryId(x.category_id),amount=cents(x.amount);if(!id||amount===null||amount<0)throw Error('Budget mensuel invalide.');run('INSERT INTO category_budgets(category_id,limit_cents) VALUES(?,?) ON CONFLICT(category_id) DO UPDATE SET limit_cents=excluded.limit_cents',id,amount);}
    else if(route==='/api/goals/delete'){if(!q('SELECT id FROM goals WHERE id=?',Number(x.id)).length)throw Error('Objectif introuvable.');run('DELETE FROM goals WHERE id=?',Number(x.id));}
    else if(route==='/api/goals'){const name=String(x.name||'').trim(),target=cents(x.target),saved=cents(x.saved),date=x.target_date||null;if(!name||name.length>80||target===null||target<=0||saved===null||saved<0||(date&&!validDate(date)))throw Error('Objectif invalide.');if(x.id){if(!q('SELECT id FROM goals WHERE id=?',Number(x.id)).length)throw Error('Objectif introuvable.');run('UPDATE goals SET name=?,target_cents=?,saved_cents=?,target_date=? WHERE id=?',name,target,saved,date,Number(x.id));}else run('INSERT INTO goals(name,target_cents,saved_cents,target_date) VALUES(?,?,?,?)',name,target,saved,date);}
    else if(route==='/api/balance/reconcile'){const account=q('SELECT * FROM accounts WHERE id=?',Number(x.account_id))[0],balance=cents(x.balance);if(!account||balance===null||x.expected_balance_cents!==account.balance_cents||x.confirm!==true)throw Error('Solde modifié depuis l’aperçu ou confirmation manquante. Actualisez et recommencez.');if(typeof x.note!=='string'||!x.note.trim()||x.note.length>150)throw Error('Indiquez une note (150 caractères maximum).');atomic(()=>{run('INSERT INTO balance_reconciliations(account_id,old_balance_cents,new_balance_cents,happened_on,note) VALUES(?,?,?,?,?)',account.id,account.balance_cents,balance,today(),x.note.trim());run('UPDATE accounts SET balance_cents=? WHERE id=?',balance,account.id);});}
    else if(route==='/api/import/inspect'){const p=parseCSV(x.csv,x.delimiter);return {headers:p.headers,delimiter:p.delimiter,sample:p.rows.slice(0,3),count:p.rows.length};}
    else if(route==='/api/import/preview')return preview(x);
    else if(route==='/api/import/commit')return importCSV(x);
    else if(route==='/api/backup/validate')return {counts:validateBackup(x.backup)};
    else if(route==='/api/backup/restore'){if(x.confirm!=='REMPLACER')throw Error('Confirmation requise.');return restore(x.backup);}
    else return null;
    return {changed:true};
  }
  return {post,monthly,exportBackup,categoryId,state:()=>({version:'5.1.0',categories:q('SELECT * FROM categories ORDER BY name'),subcategories:q('SELECT * FROM subcategories ORDER BY name'),goals:q('SELECT * FROM goals ORDER BY id DESC'),balance_reconciliations:q('SELECT r.*,a.name account_name FROM balance_reconciliations r JOIN accounts a ON a.id=r.account_id ORDER BY r.id DESC LIMIT 30'),recent_descriptions:q('SELECT t.description,t.category_id,t.subcategory_id,t.account_id,t.envelope_id,t.amount_cents FROM transactions t JOIN (SELECT MAX(id) id FROM transactions GROUP BY LOWER(TRIM(description))) recent ON recent.id=t.id ORDER BY t.id DESC LIMIT 15')})};
}
