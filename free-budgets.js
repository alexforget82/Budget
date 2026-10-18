import {cardEnvelopeTotal} from './card-envelope-funds.js';
// Free budgets share envelope IDs, reserves and transaction links. No second ledger.
import {createHash} from 'node:crypto';
export const suggestions=['Piscine et terrassement','Outils','Meubles et fournitures','Électroniques','Vêtements','Jeux et jouets','Essentiels pour la maison','Auto : Entretien et pièces','Maison : Entretien et amélioration'];
export const normalizeBudgetName=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function createFreeBudgets({db,atomic,cents,today,exportBackup,forecastInput,buildForecast}){
 const q=(sql,...a)=>db.prepare(sql).all(...a),run=(sql,...a)=>db.prepare(sql).run(...a);
 const hasRule=id=>q("SELECT 1 FROM recurring WHERE envelope_id=? AND active=1 AND (type='reserve' OR (type='expense' AND one_time=0))",id).length>0;
 const isFree=e=>e.frequency==='none'&&e.budget_cents===0&&e.forecast_spend===0&&!hasRule(e.id);
 const find=id=>q('SELECT * FROM envelopes WHERE id=?',Number(id))[0];
 function state(){
  const items=q('SELECT * FROM envelopes ORDER BY name COLLATE NOCASE').filter(isFree).map(e=>{
   const all=q('SELECT t.*,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.envelope_id=? AND t.amount_cents<0 AND t.happened_on<=? ORDER BY t.happened_on DESC,t.id DESC',e.id,today());
   return {...e,spent_month_cents:all.filter(t=>t.happened_on.startsWith(today().slice(0,7))).reduce((s,t)=>s-t.amount_cents,0),spent_total_cents:all.reduce((s,t)=>s-t.amount_cents,0),recent:all.slice(0,5)};
  });
  return {items,suggestions};
 }
 function uniqueName(name,except){const value=String(name||'').trim();if(!value||value.length>80)throw Error('Indiquez un nom de 80 caractères maximum.');if(q('SELECT id,name FROM envelopes').some(e=>e.id!==except&&normalizeBudgetName(e.name)===normalizeBudgetName(value)))throw Error('Une enveloppe ou un budget porte déjà ce nom. Reprenez l’enveloppe existante.');return value;}
 function insert(name){return Number(run("INSERT INTO envelopes(name,reserved_cents,budget_cents,frequency,start_on,rollover,active,forecast_account_id,forecast_spend,planning_since) VALUES(?,0,0,'none',NULL,0,1,NULL,0,?)",name,today()).lastInsertRowid);}
 function preview(x){
  const e=find(x.id),amount=cents(x.amount),direction=x.direction??'add';if(!e||!isFree(e)||!e.active||amount===null||amount<=0||!['add','release'].includes(direction))throw Error('Choisissez un budget libre actif et un montant positif.');
  if(direction==='release'&&amount>e.reserved_cents)throw Error('Le montant à libérer dépasse la réserve de ce budget.');
  const delta=direction==='add'?amount:-amount,next=e.reserved_cents+delta;if(!Number.isSafeInteger(next)||next>1e12)throw Error('Montant réservé trop élevé.');
  const args=forecastInput(),cash=args.accounts.filter(a=>a.kind!=='credit'&&a.included).reduce((s,a)=>s+a.balance_cents,0),reserved=args.envelopes.reduce((s,e)=>s+e.reserved_cents,0)+cardEnvelopeTotal(args),baseline=buildForecast(args).days;
  const projected=buildForecast({...args,envelopes:args.envelopes.map(item=>item.id===e.id?{...item,reserved_cents:next}:item)}).days,min=projected.reduce((a,b)=>a.safe_cents<=b.safe_cents?a:b);
  const token=createHash('sha256').update(JSON.stringify([exportBackup().tables,args.today,e.id,amount,direction])).digest('hex');
  return {id:e.id,name:e.name,direction,amount_cents:amount,reserved_before_cents:e.reserved_cents,reserved_after_cents:next,cash_cents:cash,safe_before_cents:cash-reserved,safe_after_cents:cash-reserved-delta,min_before_cents:Math.min(...baseline.map(d=>d.safe_cents)),min_after_cents:min.safe_cents,min_on:min.date,needs_ack:direction==='add'&&(cash-reserved-delta<0||min.safe_cents<0),token};
 }
 function post(route,x){
  if(route==='/api/free-budgets/preview')return preview(x);
  if(route==='/api/free-budgets/fund'){
   const p=preview(x);if(x.token!==p.token)throw Error('Le budget a changé depuis l’aperçu. Recalculez avant de confirmer.');if(p.needs_ack&&x.allow_negative!==true)throw Error('Confirmez explicitement le disponible négatif avant de réserver ce montant.');
   atomic(()=>run('UPDATE envelopes SET reserved_cents=? WHERE id=?',p.reserved_after_cents,p.id));return;
  }
  if(route==='/api/free-budgets/create'){insert(uniqueName(x.name));return;}
  if(route==='/api/free-budgets/starter'){
   // Repeated use and existing names never create a duplicate or change an old envelope.
   atomic(()=>{const names=new Set(q('SELECT name FROM envelopes').map(e=>normalizeBudgetName(e.name)));for(const name of suggestions)if(!names.has(normalizeBudgetName(name))){insert(name);names.add(normalizeBudgetName(name));}});return;
  }
  const e=find(x.id);if(!e)throw Error('Enveloppe introuvable.');
  if(route==='/api/free-budgets/delete'){
   if(!isFree(e)||x.expected_reserved_cents!==e.reserved_cents)throw Error('La réserve a changé ou ce poste n’est plus libre. Actualisez avant de supprimer.');
   if(q('SELECT 1 FROM transactions WHERE envelope_id=?',e.id).length||q('SELECT 1 FROM recurring WHERE envelope_id=?',e.id).length)throw Error('Ce budget a des achats ou des récurrences associés. Mettez-le en pause pour conserver son historique.');
   run('DELETE FROM envelopes WHERE id=?',e.id);return;
  }
  if(route==='/api/free-budgets/adopt'){
   if(e.frequency!=='none'||hasRule(e.id))throw Error('Cette enveloppe a une programmation. Mettez ses récurrences en pause et retirez son renouvellement avant de la reprendre comme budget libre.');
   if(x.expected_reserved_cents!==e.reserved_cents||x.expected_budget_cents!==e.budget_cents||x.expected_forecast_spend!==e.forecast_spend)throw Error('L’enveloppe a changé. Actualisez avant de la reprendre.');
   run("UPDATE envelopes SET budget_cents=0,forecast_spend=0,start_on=NULL WHERE id=?",e.id);return;
  }
  if(route==='/api/free-budgets/update'){
   if(!isFree(e))throw Error('Ce poste n’est plus un budget libre. Actualisez.');if(typeof x.active!=='boolean')throw Error('État du budget invalide.');run('UPDATE envelopes SET name=?,active=? WHERE id=?',uniqueName(x.name,e.id),x.active?1:0,e.id);return;
  }
  throw Error('Action inconnue.');
 }
 return {state,post};
}
