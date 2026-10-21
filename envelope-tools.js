import {envelopeBudgetDates} from './budget-schedule.js';
import {nextOccurrence} from './recurrence-calendar.js';
import {cardEnvelopeTotal} from './card-envelope-funds.js';
// Envelope presentation and reviewed configuration use the existing ledger exclusively.
import {createHash} from 'node:crypto';
export function createEnvelopeTools({db,atomic,cents,validDate,today,exportBackup,forecastInput,buildForecast}) {
 const all=(sql,...args)=>db.prepare(sql).all(...args);
 const rulesFor=(id)=>all("SELECT * FROM recurring WHERE envelope_id=? AND active=1",id);
 function preview(x){
  if(!Array.isArray(x.changes)||!x.changes.length||x.changes.length>200||new Set(x.changes.map(c=>c?.id)).size!==x.changes.length)throw Error('Choisissez de 1 à 200 enveloppes différentes.');
  const args=forecastInput(),changes=x.changes.map(c=>{
   const old=args.envelopes.find(e=>e.id===c.id);if(!old||!['reserved','dated','free'].includes(c.mode))throw Error('Enveloppe ou usage invalide.');
   const rules=rulesFor(old.id),next={...old};
   if(c.mode==='free'){
    if(rules.some(r=>r.type==='reserve'||(r.type==='expense'&&!r.one_time)))throw Error(old.name+' : mettez ses récurrences de réserve ou de dépenses régulières en pause avant de choisir Budget libre.');
    Object.assign(next,{budget_cents:0,frequency:'none',start_on:null,forecast_spend:0});
   }else{
    const budget=c.budget===undefined?old.budget_cents:cents(c.budget),frequency=c.frequency??old.frequency,start=c.start_on??old.start_on;
    if(budget===null||budget<=0||!['weekly','biweekly','monthly','quarterly','semiannual','yearly'].includes(frequency)||!validDate(start))throw Error(old.name+' : indiquez un budget positif, une fréquence et une date de début. Configurez séparément les enveloppes sans programmation.');
    if((budget!==old.budget_cents||frequency!==old.frequency||start!==old.start_on)&&start<=today())throw Error(old.name+' : une nouvelle programmation doit commencer à une date future. La réserve actuelle reste disponible dans « Ajuster l’enveloppe ».');
    const account=c.account_id===undefined?old.forecast_account_id:c.account_id===null?null:c.account_id;
    if(account!==null&&!args.accounts.some(a=>a.id===account))throw Error('Compte introuvable.');
    if(c.mode==='dated'&&account===null)throw Error(old.name+' : choisissez le compte du paiement prévu.');
    Object.assign(next,{budget_cents:budget,frequency,start_on:start,forecast_spend:c.mode==='dated'?1:0,forecast_account_id:account});
   }
   const notes=rules.filter(r=>r.type==='expense').map(r=>'Paiement programmé séparément conservé : '+r.description);
   return {id:old.id,name:old.name,mode:c.mode,before:old,after:next,notes};
  });
  const envelopes=args.envelopes.map(e=>changes.find(c=>c.id===e.id)?.after||e),before=buildForecast(args).days,after=buildForecast({...args,envelopes}).days;
  const min=after.reduce((a,b)=>a.safe_cents<=b.safe_cents?a:b),token=createHash('sha256').update(JSON.stringify([exportBackup().tables,args.today,changes.map(c=>c.after)])).digest('hex');
  const cash=args.accounts.filter(a=>a.kind!=='credit'&&a.included).reduce((n,a)=>n+a.balance_cents,0),reserved=args.envelopes.reduce((n,e)=>n+e.reserved_cents,0)+cardEnvelopeTotal(args);
  return {changes,token,cash_cents:cash,safe_cents:cash-reserved,min_before_cents:Math.min(...before.map(d=>d.safe_cents)),min_after_cents:min.safe_cents,min_on:min.date,needs_ack:min.safe_cents<0};
 }
 function post(route,x){
  const result=preview(x);if(route==='/api/envelope-tools/preview')return result;
  if(route!=='/api/envelope-tools/apply')throw Error('Action inconnue.');
  if(x.token!==result.token)throw Error('Le budget a changé depuis l’aperçu. Recommencez la vérification.');
  if(result.needs_ack&&x.allow_negative!==true)throw Error('Confirmez le risque de disponible négatif.');
  atomic(()=>{for(const c of result.changes){const e=c.after;db.prepare('UPDATE envelopes SET budget_cents=?,frequency=?,start_on=?,forecast_spend=?,forecast_account_id=? WHERE id=?').run(e.budget_cents,e.frequency,e.start_on,e.forecast_spend,e.forecast_account_id,e.id);}});
 }
 function insights(envelopes,details,simulation){
  const transactions=all('SELECT t.*,a.name account_name,c.name category_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN categories c ON c.id=t.category_id WHERE t.happened_on<=? ORDER BY t.happened_on DESC,t.id DESC',today()),freeIds=new Set(envelopes.filter(e=>e.frequency==='none'&&e.budget_cents===0&&e.forecast_spend===0&&!rulesFor(e.id).some(r=>r.type==='reserve'||r.type==='expense'&&!r.one_time)).map(e=>e.id));
  const transfers=all('SELECT t.*,a.name from_name,b.name to_name FROM account_transfers t JOIN accounts a ON a.id=t.from_account_id JOIN accounts b ON b.id=t.to_account_id WHERE t.envelope_id IS NOT NULL AND t.happened_on<=? ORDER BY t.happened_on DESC,t.id DESC',today());
  const periodLinks=all('SELECT * FROM envelope_actual_links');
  const overrides=all('SELECT * FROM envelope_budget_overrides'),month=today().slice(0,7),items=envelopes.map(e=>{
   const detail=details.find(d=>d.id===e.id),own=transactions.filter(t=>t.envelope_id===e.id),spent=own.filter(t=>t.amount_cents<0&&t.happened_on.startsWith(month)).reduce((n,t)=>n-t.amount_cents,0),period=detail?.spent_cents||0,budget=overrides.find(o=>o.envelope_id===e.id&&o.occurrence_on===detail?.period_start)?.budget_cents??e.budget_cents;
   const next=detail?.next_renewal,nextBudget=next?(overrides.find(o=>o.envelope_id===e.id&&o.occurrence_on===next)?.budget_cents??envelopeBudgetDates(e,next,next,nextOccurrence)[0]?.amount_cents??e.budget_cents):0,nextSpent=own.filter(t=>t.amount_cents<0&&periodLinks.some(l=>l.transaction_id===t.id&&l.occurrence_on===next)).reduce((n,t)=>n-t.amount_cents,0);
   return {next_period_spent_cents:nextSpent,next_period_remaining_cents:nextBudget-nextSpent,id:e.id,mode:freeIds.has(e.id)?'free':e.forecast_spend===0?'reserved':'dated',spent_month_cents:spent,spent_period_cents:period,period_budget_cents:budget,over_budget_cents:detail?.period_start&&e.frequency!=='none'?Math.max(0,period-budget):0,transferred_month_cents:transfers.filter(t=>t.envelope_id===e.id&&t.happened_on.startsWith(month)).reduce((n,t)=>n+t.amount_cents,0),transfers:transfers.filter(t=>t.envelope_id===e.id).slice(0,30),recent:own.slice(0,10),transaction_count:own.length,next_renewal:detail?.next_renewal,period_start:detail?.period_start};
  });
  const unassigned=transactions.filter(t=>t.amount_cents<0&&!t.envelope_id&&t.happened_on.startsWith(month));
  const currentCash=all('SELECT * FROM accounts').filter(a=>a.kind!=='credit'&&a.included).reduce((n,a)=>n+a.balance_cents,0),currentSafe=currentCash-envelopes.reduce((n,e)=>n+e.reserved_cents,0)-(simulation.opening_card_envelope_cents??cardEnvelopeTotal({accounts:all('SELECT * FROM accounts'),envelopes,transactions,transfers:all('SELECT * FROM account_transfers'),today:today()}));
  const payday=simulation.days.flatMap(d=>d.events.map(e=>({...e,date:d.date}))).find(e=>e.type==='income'&&e.cash_impact_cents>0&&!e.overdue),window=simulation.days.filter(d=>!payday||d.date<payday.date||d.date===today()).slice(0,payday?90:30),risk=currentSafe<0?{date:today(),safe_cents:currentSafe}:window.find(d=>d.safe_cents<0);
  return {month,items,unassigned_count:unassigned.length,unassigned_cents:unassigned.reduce((n,t)=>n-t.amount_cents,0),unassigned_recent:unassigned.slice(0,5),risk:risk?{date:risk.date,safe_cents:risk.safe_cents,payday:payday?.date||null}:null};
 }
 return {post,insights};
}
