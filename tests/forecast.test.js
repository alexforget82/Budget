import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForecast} from '../forecast-engine.js';
const today='2026-10-17';
function nextOccurrence(start,frequency,i){const d=new Date(start+'T12:00:00Z');if(frequency==='weekly'||frequency==='biweekly')d.setUTCDate(d.getUTCDate()+i*(frequency==='weekly'?7:14));else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}return d.toISOString().slice(0,10);}
const account={id:1,name:'Chèques',kind:'checking',included:1,balance_cents:200000};
const envelope={id:1,name:'Épicerie',reserved_cents:23000,budget_cents:23000,active:1,frequency:'weekly',start_on:'2026-10-22',rollover:0,forecast_spend:1,forecast_account_id:1,planning_since:today};
const rule=(extra={})=>({id:1,description:'Facture',type:'expense',amount_cents:10000,account_id:1,start_on:'2026-10-22',frequency:'weekly',active:1,...extra});
const run=extra=>buildForecast({accounts:[account],envelopes:[envelope],recurring:[],today,since:today,nextOccurrence,occurrenceInfo:(s,f,i)=>({date:nextOccurrence(s,f,i)}),similarDescription:(a,b)=>a===b,...extra});
const at=(s,date)=>s.days.find(d=>d.date===date);
test('230 dollars every Thursday reduces the November 5 bank balance by 690, with no double reserve deduction',()=>{
 const data={accounts:[account],envelopes:[envelope]},before=structuredClone(data),s=run(data);
 assert.equal(at(s,'2026-10-21').cash_cents,200000);assert.equal(at(s,'2026-10-21').safe_cents,177000);
 assert.equal(at(s,'2026-10-22').cash_cents,177000);assert.equal(at(s,'2026-10-22').reserved_cents,0);assert.equal(at(s,'2026-10-22').safe_cents,177000);
 assert.equal(at(s,'2026-11-05').cash_cents,131000);assert.equal(at(s,'2026-11-05').safe_cents,131000);assert.deepEqual(data,before);
 assert.equal(at(s,'2026-10-22').events.find(e=>e.envelope_spending).amount_cents,23000);
});
test('actual 215 replaces planned 230, leaves the real unused reserve, and changes next bank balance by 15',()=>{
 const s=run({today:'2026-10-23',accounts:[{...account,balance_cents:178500}],envelopes:[{...envelope,reserved_cents:1500}],transactions:[{id:1,account_id:1,envelope_id:1,amount_cents:-21500,description:'Marché',happened_on:'2026-10-22'}],renewals:[{envelope_id:1,occurrence_on:'2026-10-22'}]});
 const row=s.rows.find(r=>r.date==='2026-10-22');assert.equal(row.status,'actual');assert.equal(row.actual_cents,21500);assert.equal(row.variance_cents,-1500);assert.equal(row.remaining_cents,0);
 assert.equal(s.days[0].cash_cents,178500);assert.equal(s.days[0].reserved_cents,1500);assert.equal(at(s,'2026-10-29').cash_cents,155500);
});
test('partial envelope purchases aggregate and only the explicitly reopened remainder is projected',()=>{
 const txs=[{id:1,account_id:1,envelope_id:1,amount_cents:-10000,happened_on:'2026-10-22'},{id:2,account_id:1,envelope_id:1,amount_cents:-5000,happened_on:'2026-10-23'}];
 const s=run({today:'2026-10-24',accounts:[{...account,balance_cents:185000}],envelopes:[{...envelope,reserved_cents:8000}],transactions:txs,periods:[{envelope_id:1,occurrence_on:'2026-10-22',status:'open'}]});
 const row=s.rows[0];assert.equal(row.actual_cents,15000);assert.equal(row.remaining_cents,8000);assert.equal(row.status,'pending');assert.equal(s.days[0].cash_cents,177000);assert.equal(s.days[0].reserved_cents,0);
});
test('all envelopes, income, bills and internal transfers combine into exact cash balances',()=>{
 const s=run({accounts:[account,{id:2,kind:'savings',included:1,balance_cents:50000}],envelopes:[envelope,{...envelope,id:2,name:'Essence',budget_cents:6000,reserved_cents:6000}],recurring:[rule({type:'income',amount_cents:100000}),rule({id:2,amount_cents:40000}),rule({id:3,type:'transfer',account_id:1,to_account_id:2,amount_cents:10000})]});
 assert.equal(at(s,'2026-10-22').cash_cents,281000);assert.equal(at(s,'2026-10-22').reserved_cents,0);
 assert.equal(at(s,'2026-10-22').account_balances.find(a=>a.id===2).balance_cents,60000);
});
test('missing envelope account still deducts from total cash and emits an actionable warning',()=>{
 const s=run({envelopes:[{...envelope,forecast_account_id:null}]});assert.equal(at(s,'2026-10-22').cash_cents,177000);assert.ok(s.warnings.some(w=>w.code==='envelope_account'));
});
test('unscheduled envelopes warn while savings-only envelopes reserve without generating spending',()=>{
 const s=run({envelopes:[{...envelope,frequency:'none'},{...envelope,id:2,forecast_spend:0}]});assert.equal(s.rows.length,0);assert.equal(s.days[0].safe_cents,154000);assert.equal(s.warnings.filter(w=>w.code==='envelope_unscheduled').length,1);
});
test('linked expense owns the envelope schedule and consumes reserve only once',()=>{
 const s=run({recurring:[rule({envelope_id:1,amount_cents:23000})]});assert.equal(s.rows.filter(r=>r.date==='2026-10-22').length,1);assert.equal(at(s,'2026-10-22').cash_cents,177000);assert.equal(at(s,'2026-10-22').safe_cents,177000);
});
test('overdue expenses remain deducted; overdue income never funds spending before receipt',()=>{
 const s=run({today:'2026-10-24',envelopes:[],recurring:[rule({one_time:1}),rule({id:2,type:'income',one_time:1,amount_cents:50000})]});assert.equal(s.days[0].cash_cents,190000);assert.equal(s.rows.filter(r=>r.status==='pending').length,2);assert.equal(s.days[0].events.length,1);
});
test('manual match accepts a different actual amount, and deleting that actual restores the forecast',()=>{
 const extra={envelopes:[],accounts:[{...account,balance_cents:191000}],recurring:[rule({one_time:1})],transactions:[{id:1,account_id:1,amount_cents:-9000,description:'Autre nom',happened_on:'2026-10-22'}],links:[{recurring_id:1,occurrence_on:'2026-10-22',actual_type:'transaction',actual_id:1}]};
 const s=run(extra);assert.equal(s.rows[0].actual_cents,9000);assert.equal(at(s,'2026-10-22').cash_cents,191000);
 const deleted=run({...extra,transactions:[]});assert.equal(at(deleted,'2026-10-22').cash_cents,181000);
});
test('unique automatic matches prevent duplication; ambiguous matches remain unconfirmed',()=>{
 const tx={id:1,account_id:1,amount_cents:-10000,description:'Facture',happened_on:'2026-10-22'};
 let s=run({envelopes:[],recurring:[rule()],transactions:[tx]});assert.equal(s.rows[0].status,'actual');
 s=run({envelopes:[],recurring:[rule(),rule({id:2})],transactions:[tx]});assert.equal(s.rows.filter(r=>r.status==='actual').length,0);
});
test('exceptions, skipped periods and moved occurrences affect only the targeted date',()=>{
 const s=run({envelopeOverrides:[{envelope_id:1,occurrence_on:'2026-10-22',budget_cents:10000}],periods:[{envelope_id:1,occurrence_on:'2026-10-29',status:'skipped'}],recurring:[rule({one_time:1})],moves:[{recurring_id:1,occurrence_on:'2026-10-22',new_on:'2026-10-24'}]});
 assert.equal(at(s,'2026-10-22').cash_cents,190000);assert.equal(at(s,'2026-10-24').cash_cents,180000);assert.equal(at(s,'2026-10-29').cash_cents,180000);assert.equal(s.rows.find(r=>r.recurring_id===1).original_on,'2026-10-22');
});
test('planned recurring card purchases protect available money before the bank is debited once',()=>{
 const s=run({accounts:[account,{id:2,name:'Carte',kind:'credit',included:0,balance_cents:0}],envelopes:[],recurring:[rule({type:'expense',account_id:2,one_time:1}),rule({id:2,type:'transfer',to_account_id:2,one_time:1,start_on:'2026-10-24'})]});
 assert.equal(at(s,'2026-10-22').cash_cents,200000);assert.equal(at(s,'2026-10-22').account_balances.find(a=>a.id===2).balance_cents,10000);assert.equal(at(s,'2026-10-22').safe_cents,190000);assert.equal(at(s,'2026-10-22').events[0].sts_impact_cents,-10000);assert.equal(at(s,'2026-10-24').events.find(e=>e.type==='transfer').sts_impact_cents,0);assert.equal(at(s,'2026-10-24').safe_cents,190000);assert.equal(at(s,'2026-10-24').cash_cents,190000);assert.equal(at(s,'2026-10-24').account_balances.find(a=>a.id===2).balance_cents,0);
});
test('rollover and exceptional budgets change reserves without inventing bank movements',()=>{
 const s=run({envelopes:[{...envelope,forecast_spend:0,rollover:1}],envelopeOverrides:[{envelope_id:1,occurrence_on:'2026-10-22',budget_cents:10000}]});assert.equal(at(s,'2026-10-22').cash_cents,200000);assert.equal(at(s,'2026-10-22').reserved_cents,33000);
});

test('a one-time linked expense replaces only its own envelope period, not future weekly groceries',()=>{
 const s=run({recurring:[rule({envelope_id:1,amount_cents:23000,one_time:1})]});assert.equal(at(s,'2026-11-05').cash_cents,131000);assert.equal(s.rows.filter(r=>r.source==='envelope'&&r.date==='2026-10-29').length,1);
});

test('every bank bridge reconciles starting cash, categorized impacts, closing balance and reserves',()=>{
 const s=run({accounts:[account,{id:2,kind:'savings',included:0,balance_cents:50000},{id:3,kind:'credit',included:0,balance_cents:500000}],recurring:[rule({type:'income',amount_cents:100000}),rule({id:2,type:'transfer',to_account_id:2,amount_cents:10000}),rule({id:3,amount_cents:20000}),rule({id:4,type:'expense',account_id:3,amount_cents:5000})]});
 for(const day of s.days){const c=day.bridge;assert.equal(c.opening_cash_cents+c.income_cents+c.expense_cents+c.envelope_cents+c.transfer_cents,day.cash_cents);assert.equal(c.closing_cash_cents-c.reserved_cents,day.safe_cents);assert.equal(c.closing_safe_cents,day.safe_cents);}
 const c=at(s,'2026-10-22').bridge;assert.equal(c.opening_cash_cents,200000);assert.equal(c.income_cents,100000);assert.equal(c.expense_cents,-20000);assert.equal(c.envelope_cents,-23000);assert.equal(c.transfer_cents,-10000);assert.equal(c.closing_cash_cents,247000);
});
test('internal transfers and reserve-only renewals explain zero bank movement without hiding them',()=>{
 const s=run({accounts:[account,{id:2,kind:'savings',included:1,balance_cents:0}],envelopes:[{...envelope,forecast_spend:0}],recurring:[rule({type:'transfer',to_account_id:2,amount_cents:5000})]});const d=at(s,'2026-10-22');assert.equal(d.bridge.transfer_cents,0);assert.equal(d.cash_cents,200000);assert.equal(d.events.length,2);assert.ok(d.events.every(e=>e.cash_impact_cents===0));
});
test('an actual transaction explicitly linked to an old envelope occurrence is never counted in a newer period',()=>{
 const s=run({today:'2026-10-30',accounts:[{...account,balance_cents:178500}],envelopes:[{...envelope,reserved_cents:1500}],transactions:[{id:1,envelope_id:1,account_id:1,amount_cents:-21500,happened_on:'2026-10-30'}],envelopeLinks:[{transaction_id:1,envelope_id:1,occurrence_on:'2026-10-22'}],periods:[{envelope_id:1,occurrence_on:'2026-10-22',status:'complete'}]});
 const old=s.rows.find(r=>r.original_on==='2026-10-22'),next=s.rows.find(r=>r.original_on==='2026-10-29');assert.equal(old.actual_cents,21500);assert.equal(old.status,'actual');assert.equal(next.actual_cents,null);assert.equal(next.remaining_cents,23000);
});
test('postponing an envelope expense moves only spending; automatic actual matching follows effective dates',()=>{
 const args={envelopeMoves:[{envelope_id:1,occurrence_on:'2026-10-22',new_on:'2026-10-30'}]},s=run(args);assert.equal(at(s,'2026-10-22').cash_cents,200000);assert.equal(at(s,'2026-10-29').cash_cents,177000);assert.equal(at(s,'2026-10-30').cash_cents,154000);const moved=s.rows.find(r=>r.original_on==='2026-10-22');assert.equal(moved.date,'2026-10-30');assert.equal(moved.key,'env-1|2026-10-22');
 const matched=run({...args,transactions:[{id:1,envelope_id:1,account_id:1,amount_cents:-21500,happened_on:'2026-10-30'}]});assert.equal(matched.rows.find(r=>r.original_on==='2026-10-22').actual_cents,21500);assert.equal(matched.rows.find(r=>r.original_on==='2026-10-29').actual_cents,null);
});
test('two envelope occurrences moved onto the same day remain ambiguous until explicitly associated',()=>{
 const s=run({envelopeMoves:[{envelope_id:1,occurrence_on:'2026-10-22',new_on:'2026-10-29'}],transactions:[{id:1,envelope_id:1,account_id:1,amount_cents:-21500,happened_on:'2026-10-29'}]});assert.equal(s.rows.filter(r=>r.date==='2026-10-29'&&r.status==='actual').length,0);
});
test('a planned credit-card refund reduces debt, with no bank cash or available change',()=>{
 const s=run({accounts:[account,{id:2,name:'Carte',kind:'credit',included:0,balance_cents:50000}],envelopes:[],recurring:[rule({type:'income',account_id:2,amount_cents:5000,one_time:1})]});const d=at(s,'2026-10-22');assert.equal(d.account_balances.find(a=>a.id===2).balance_cents,45000);assert.equal(d.cash_cents,200000);assert.equal(d.safe_cents,200000);assert.equal(d.bridge.income_cents,0);
});
