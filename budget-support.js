import {dashboardSetting} from './dashboard-layout.js';
// v4.1 support tools. Financial mutations still go through the existing ledger.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function createSupport({db,dir,features,today,cents,validDate}){
 const q=(sql,...a)=>db.prepare(sql).all(...a),hash=b=>createHash('sha256').update(JSON.stringify({...b.tables,app_settings:b.tables.app_settings.filter(s=>!dashboardSetting(s.key))})).digest('hex');
 const folder=path.join(dir,'backups'),undoFile=path.join(dir,'last-change.json');let backupError=null,undoError=null;
 const get=key=>{try{const v=JSON.parse(q('SELECT value FROM app_settings WHERE key=?','v41_'+key)[0]?.value||'[]');return Array.isArray(v)?v.filter(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&(key==='profiles'?Array.isArray(i.config?.headers)&&i.config.mapping&&['ISO','DMY','MDY'].includes(i.config.date_format):i.payload?.kind==='purchase'&&validDate(i.payload.date))):[];}catch{return [];}};
 const put=(key,value)=>db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('v41_'+key,JSON.stringify(value));
 function undoRecord(){try{return JSON.parse(fs.readFileSync(undoFile,'utf8'));}catch{return null;}}
 function ledgerFingerprint(id){return createHash('sha256').update(JSON.stringify([q('SELECT * FROM accounts WHERE id=?',id),q('SELECT * FROM transactions WHERE account_id=? ORDER BY id',id),q('SELECT * FROM account_transfers WHERE from_account_id=? OR to_account_id=? ORDER BY id',id,id)])).digest('hex');}
 function checkpoints(){try{const value=JSON.parse(q("SELECT value FROM app_settings WHERE key='v53_bank_checks'")[0]?.value||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
 function bankChecks(){const saved=checkpoints();return q('SELECT id FROM accounts').map(a=>{const c=saved[a.id];return {account_id:a.id,checked_at:c?.checked_at||null,balance_cents:c?.balance_cents??null,current:!!c&&c.fingerprint===ledgerFingerprint(a.id)};});}
 function state(){
  const u=undoRecord(),available=!!u&&u.after===hash(features.exportBackup());let files=[],lastAt=null;
  try{files=fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>/^daily-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort():[];if(files.length)lastAt=fs.statSync(path.join(folder,files.at(-1))).mtime.toISOString();}catch(e){backupError='Impossible de lire les copies quotidiennes : '+e.message;}
  return {bank_checks:bankChecks(),profiles:get('profiles'),scenarios:get('scenarios'),undo:{available,token:available?u.token:null,label:available?u.label:null,error:undoError},backup:{last_date:files.at(-1)?.slice(6,16)||null,count:files.length,dates:files.map(f=>f.slice(6,16)),last_at:lastAt,error:backupError}};
 }
 function recordUndo(before,route){const after=features.exportBackup();if(hash(before)===hash(after))return;try{const temp=undoFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({token:randomUUID(),label:route,after:hash(after),before}),{mode:0o600});fs.renameSync(temp,undoFile);undoError=null;}catch(e){undoError='La dernière modification ne peut pas être annulée : '+e.message;}}
 function undo(x){const u=undoRecord();if(!u||u.token!==x.token||u.after!==hash(features.exportBackup()))throw Error('Le budget a changé depuis cette modification. Actualisez; aucune donnée n’a été remplacée.');const backup=structuredClone(u.before);backup.tables.app_settings=backup.tables.app_settings.filter(s=>!dashboardSetting(s.key)).concat(features.exportBackup().tables.app_settings.filter(s=>dashboardSetting(s.key)));const result=features.post('/api/backup/restore',{backup,confirm:'REMPLACER'});fs.unlinkSync(undoFile);return result;}
 function dailyBackup(force=false){try{fs.mkdirSync(folder,{recursive:true,mode:0o700});const file=path.join(folder,'daily-'+today()+'.json');if(force||!fs.existsSync(file)){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(features.exportBackup()),{mode:0o600});fs.renameSync(tmp,file);}const files=fs.readdirSync(folder).filter(f=>/^daily-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();for(const old of files.slice(0,-30))fs.unlinkSync(path.join(folder,old));backupError=null;}catch(e){backupError='Sauvegarde quotidienne impossible : '+e.message;}}
 function search(term){const normalize=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA'),needle=normalize(term).trim();if(needle.length<2||needle.length>100)return {results:[]};const results=[];
  for(const [table,kind,column,route] of [['accounts','Compte','name','comptes'],['envelopes','Enveloppe','name','enveloppes'],['recurring','Récurrence','description','recurrences'],['transactions','Transaction','description','transactions'],['account_transfers','Virement','description','virements'],['goals','Objectif','name','objectifs']]){
   // Full history is searched; results are capped only after matching.
   for(const r of q(`SELECT * FROM ${table} ORDER BY id DESC`)){if(normalize(r[column]).includes(needle)){results.push({id:r.id,kind,route,name:r[column],date:r.happened_on||r.start_on||null,amount_cents:r.amount_cents??r.balance_cents??null,record:r});if(results.filter(v=>v.kind===kind).length>=15)break;}}
  }return {results};
 }
 function reconcile(x){const account=q('SELECT * FROM accounts WHERE id=?',Number(x.account_id))[0],balance=cents(x.balance);if(!account||balance===null)throw Error('Choisissez le compte et son solde bancaire actuel.');const since=x.since||today().slice(0,7)+'-01';if(!validDate(since)||since>today())throw Error('Date de comparaison invalide.');const tx=q('SELECT * FROM transactions WHERE account_id=? AND happened_on>=? AND happened_on<=? ORDER BY happened_on DESC,id DESC',account.id,since,today()),transfers=q('SELECT * FROM account_transfers WHERE (from_account_id=? OR to_account_id=?) AND happened_on>=? AND happened_on<=? ORDER BY happened_on DESC,id DESC',account.id,account.id,since,today());const delta=balance-account.balance_cents;const effect=t=>account.kind==='credit'?-t.amount_cents:t.amount_cents;
  return {fingerprint:ledgerFingerprint(account.id),account,bank_cents:balance,delta_cents:delta,since,transactions:tx.slice(0,100),transfers:transfers.slice(0,100),transaction_count:tx.length,transfer_count:transfers.length,candidates:tx.filter(t=>t.affects_balance!==0&&Math.abs(effect(t))===Math.abs(delta)&&delta!==0).slice(0,8),history:q('SELECT * FROM balance_reconciliations WHERE account_id=? ORDER BY id DESC LIMIT 5',account.id)};
 }
 function post(route,x){
  if(route==='/api/support/reconcile')return reconcile(x);
  if(route==='/api/support/checkpoint'){
   const out=reconcile(x);if(x.confirm!==true||out.delta_cents!==0||typeof x.fingerprint!=='string'||x.fingerprint!==out.fingerprint)throw Error('Les soldes doivent concorder et les opérations doivent être inchangées. Comparez à nouveau avant de valider.');
   const saved=checkpoints();saved[out.account.id]={checked_at:new Date().toISOString(),balance_cents:out.bank_cents,fingerprint:out.fingerprint};db.prepare("INSERT INTO app_settings(key,value) VALUES('v53_bank_checks',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(saved));return {changed:true};
  }
  if(route==='/api/support/undo')return undo(x);
  if(route==='/api/support/backup'){dailyBackup(true);if(backupError)throw Error(backupError);return {changed:true};}
  const kind=route.includes('profiles')?'profiles':'scenarios',items=get(kind);
  if(route.endsWith('/delete')){put(kind,items.filter(p=>p.id!==x.id));return {changed:true};}
  const name=String(x.name||'').trim();if(!name||name.length>60)throw Error('Choisissez un nom de 60 caractères maximum.');
  let item;
  if(kind==='profiles'){
   const config=x.config;if(!config||!Array.isArray(config.headers)||config.headers.length>60||config.headers.some(h=>typeof h!=='string'||h.length>150)||!q('SELECT 1 FROM accounts WHERE id=?',Number(config.account_id)).length||!['ISO','DMY','MDY'].includes(config.date_format)||![',',';','\t'].includes(config.delimiter))throw Error('Chargez le CSV et vérifiez son format et son compte avant de mémoriser ce profil.');
   const mapping={};for(const key of ['date','description','amount','debit','credit','category','subcategory']){const v=config.mapping?.[key];mapping[key]=v===''||v===null||v===undefined?'':String(v);if(mapping[key]!==''&&(!/^\d+$/.test(mapping[key])||Number(v)>=config.headers.length))throw Error('Colonne de profil invalide.');}
   if(mapping.date===''||mapping.description===''||(mapping.amount===''&&mapping.debit===''&&mapping.credit===''))throw Error('Associez les colonnes obligatoires.');
   item={name,config:{headers:config.headers,delimiter:config.delimiter,account_id:Number(config.account_id),mapping,date_format:config.date_format,invert_sign:config.invert_sign===true}};
  }else{const p=x.payload;if(!p||p.kind!=='purchase'||cents(p.amount)===null||cents(p.amount)<=0||!validDate(p.date)||!q('SELECT 1 FROM accounts WHERE id=?',Number(p.account_id)).length)throw Error('Scénario d’achat invalide.');item={name,payload:{kind:'purchase',amount:p.amount,date:p.date,account_id:Number(p.account_id)}};}
  const existing=items.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase());item.id=existing?.id||randomUUID();const next=items.filter(p=>p.id!==item.id);next.push(item);if(next.length>20||Buffer.byteLength(JSON.stringify(next))>9000)throw Error('Limite de profils/scénarios atteinte. Supprimez un élément avant de continuer.');put(kind,next);return {changed:true};
 }
 function dailyFile(date){if(!validDate(date))throw Error('Date de sauvegarde invalide.');const file=path.join(folder,'daily-'+date+'.json');if(!fs.existsSync(file))throw Error('Sauvegarde introuvable.');return fs.readFileSync(file);}
 return {state,recordUndo,undo,dailyBackup,dailyFile,search,post};
}
