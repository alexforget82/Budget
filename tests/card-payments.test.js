import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForecast} from '../forecast-engine.js';
function nextOccurrence(start,frequency,i){const d=new Date(start+'T12:00:00Z');if(frequency==='weekly'||frequency==='biweekly')d.setUTCDate(d.getUTCDate()+i*(frequency==='weekly'?7:14));else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}return d.toISOString().slice(0,10);}
const accounts=[{id:1,name:'Conjoint',kind:'checking',included:1,balance_cents:200000},{id:2,name:'CIBC',kind:'credit',included:0,balance_cents:500000}];
const envelope={id:1,name:'Épicerie',reserved_cents:23000,budget_cents:23000,active:1,frequency:'weekly',start_on:'2026-10-22',rollover:0,forecast_spend:1,forecast_account_id:2,planning_since:'2026-10-17'};
const driver={id:1,description:'Paiement CIBC depuis Conjoint',type:'transfer',amount_cents:1,account_id:1,to_account_id:2,start_on:'2026-10-23',frequency:'weekly',active:1};
const run=extra=>buildForecast({accounts,envelopes:[envelope],recurring:[driver],cardPaymentPlans:[{card_account_id:2,recurring_id:1,mode:'purchases'}],today:'2026-10-17',since:'2026-10-17',nextOccurrence,occurrenceInfo:(s,f,i)=>({date:nextOccurrence(s,f,i)}),similarDescription:(a,b)=>a===b,...extra});
const at=(s,date)=>s.days.find(d=>d.date===date),pay=(s,date)=>s.rows.find(r=>r.recurring_id===1&&r.original_on===date);
test('Thursday groceries increase CIBC; Friday proposed payment debits Conjoint once, without reserving old card debt',()=>{
 const before=structuredClone({accounts,envelope,driver}),s=run();assert.equal(at(s,'2026-10-21').safe_cents,177000);assert.equal(at(s,'2026-10-22').cash_cents,200000);assert.equal(at(s,'2026-10-22').account_balances[1].balance_cents,523000);assert.equal(pay(s,'2026-10-23').planned_cents,23000);assert.equal(at(s,'2026-10-23').cash_cents,177000);assert.equal(at(s,'2026-10-23').account_balances[1].balance_cents,500000);assert.equal(at(s,'2026-10-30').cash_cents,154000);assert.ok(s.days.every(d=>d.credit_reserved_cents===0));assert.deepEqual({accounts,envelope,driver},before);
});
test('an old card balance without new purchases never creates a computed repayment',()=>{const s=run({envelopes:[]});assert.ok(s.rows.every(r=>r.planned_cents===0));assert.ok(s.days.every(d=>d.cash_cents===200000&&d.safe_cents===200000));});
test('fixed payments keep the explicitly chosen amount independent of purchase suggestions',()=>{const s=run({recurring:[{...driver,amount_cents:10000}],cardPaymentPlans:[{card_account_id:2,recurring_id:1,mode:'fixed'}]});assert.equal(pay(s,'2026-10-23').planned_cents,10000);assert.equal(pay(s,'2026-10-23').card_payment_mode,'fixed');assert.equal(at(s,'2026-10-23').cash_cents,190000);});
test('a real 215 grocery purchase and matching real payment replace their predictions without another debit',()=>{
 const s=run({today:'2026-10-23',accounts:[{...accounts[0],balance_cents:178500},accounts[1]],envelopes:[{...envelope,reserved_cents:1500}],transactions:[{id:1,account_id:2,envelope_id:1,amount_cents:-21500,description:'Marché',happened_on:'2026-10-22'}],transfers:[{id:1,from_account_id:1,to_account_id:2,amount_cents:21500,description:driver.description,happened_on:'2026-10-23'}]});assert.equal(pay(s,'2026-10-23').status,'actual');assert.equal(pay(s,'2026-10-23').actual_cents,21500);assert.equal(s.days[0].cash_cents,178500);assert.equal(pay(s,'2026-10-30').planned_cents,23000);
});
test('a smaller actual payment carries only its unpaid remainder into the next proposed payment',()=>{
 const s=run({today:'2026-10-23',accounts:[{...accounts[0],balance_cents:180000},{...accounts[1],balance_cents:503000}],envelopes:[{...envelope,reserved_cents:0}],transactions:[{id:1,account_id:2,envelope_id:1,amount_cents:-23000,happened_on:'2026-10-22'}],transfers:[{id:1,from_account_id:1,to_account_id:2,amount_cents:20000,description:'Virement réel',happened_on:'2026-10-23'}],links:[{recurring_id:1,occurrence_on:'2026-10-23',actual_type:'transfer',actual_id:1}]});assert.equal(pay(s,'2026-10-23').actual_cents,20000);assert.equal(pay(s,'2026-10-30').carried_cents,3000);assert.equal(pay(s,'2026-10-30').planned_cents,26000);assert.equal(at(s,'2026-10-30').cash_cents,154000);
});
test('a one-occurrence amount override and cancellation carry unpaid purchases, without duplicate charges',()=>{
 let s=run({overrides:[{recurring_id:1,occurrence_on:'2026-10-23',amount_cents:10000}]});assert.equal(pay(s,'2026-10-23').planned_cents,10000);assert.equal(pay(s,'2026-10-30').planned_cents,36000);assert.equal(at(s,'2026-10-30').cash_cents,154000);
 s=run({overrides:[{recurring_id:1,occurrence_on:'2026-10-23',amount_cents:0}]});assert.equal(pay(s,'2026-10-30').planned_cents,46000);assert.equal(at(s,'2026-10-23').cash_cents,200000);assert.equal(at(s,'2026-10-30').cash_cents,154000);
});
test('moving a payment changes the bank debit date and includes purchases up to its effective date',()=>{
 const s=run({moves:[{recurring_id:1,occurrence_on:'2026-10-23',new_on:'2026-10-26'}],recurring:[driver,{id:2,description:'Autre achat',type:'expense',amount_cents:5000,account_id:2,start_on:'2026-10-24',frequency:'monthly',active:1,one_time:1}]});assert.equal(at(s,'2026-10-23').cash_cents,200000);assert.equal(pay(s,'2026-10-23').planned_cents,28000);assert.equal(at(s,'2026-10-26').cash_cents,172000);assert.equal(pay(s,'2026-10-30').planned_cents,23000);
});
test('refunds reduce the suggestion and an existing credit balance caps it without an automatic reserve',()=>{
 let s=run({accounts:[accounts[0],{...accounts[1],balance_cents:0}],transactions:[{id:1,account_id:2,amount_cents:3000,happened_on:'2026-10-21'}]});assert.equal(pay(s,'2026-10-23').planned_cents,20000);
 s=run({accounts:[accounts[0],{...accounts[1],balance_cents:-10000}]});assert.equal(pay(s,'2026-10-23').suggested_cents,23000);assert.equal(pay(s,'2026-10-23').planned_cents,13000);assert.equal(at(s,'2026-10-23').account_balances[1].balance_cents,0);
});
test('payment impacts reconcile with the dated bank-balance explanation',()=>{const s=run();for(const d of s.days){const c=d.bridge;assert.equal(c.opening_cash_cents+c.income_cents+c.expense_cents+c.envelope_cents+c.transfer_cents,d.cash_cents);assert.equal(d.credit_reserved_cents,0);}assert.equal(at(s,'2026-10-23').bridge.transfer_cents,-23000);assert.equal(at(s,'2026-10-23').bridge.envelope_cents,0);});
test('excess merchant refunds carry forward as a credit against later new purchases',()=>{const s=run({transactions:[{id:1,account_id:2,amount_cents:30000,happened_on:'2026-10-21'}]});assert.equal(pay(s,'2026-10-23').planned_cents,0);assert.equal(pay(s,'2026-10-30').carried_cents,-7000);assert.equal(pay(s,'2026-10-30').planned_cents,16000);});
test('monthly and biweekly plans partition purchases without overlapping payment periods',()=>{
 let s=run({recurring:[{...driver,start_on:'2026-10-31',frequency:'monthly'}]});assert.equal(pay(s,'2026-10-31').planned_cents,46000);assert.equal(pay(s,'2026-11-30').planned_cents,92000);
 s=run({recurring:[{...driver,frequency:'biweekly'}]});assert.equal(pay(s,'2026-10-23').planned_cents,23000);assert.equal(pay(s,'2026-11-06').planned_cents,46000);
});
test('two cards paid from the same bank account each produce one independent payment',()=>{
 const s=run({accounts:[...accounts,{id:3,name:'Visa',kind:'credit',included:0,balance_cents:100000}],envelopes:[envelope,{...envelope,id:2,name:'Essence',budget_cents:6000,reserved_cents:6000,forecast_account_id:3}],recurring:[driver,{...driver,id:2,to_account_id:3,description:'Paiement Visa depuis Conjoint'}],cardPaymentPlans:[{card_account_id:2,recurring_id:1,mode:'purchases'},{card_account_id:3,recurring_id:2,mode:'purchases'}]});assert.equal(at(s,'2026-10-23').cash_cents,171000);assert.equal(s.rows.find(r=>r.recurring_id===2&&r.date==='2026-10-23').planned_cents,6000);assert.equal(at(s,'2026-10-23').account_balances[2].balance_cents,100000);
});
test('a vague real payment that cleared the card stays available for association instead of disappearing at zero debt',()=>{
 const s=run({today:'2026-10-23',accounts:[{...accounts[0],balance_cents:178500},{...accounts[1],balance_cents:0}],envelopes:[{...envelope,reserved_cents:1500}],transactions:[{id:1,account_id:2,envelope_id:1,amount_cents:-21500,happened_on:'2026-10-22'}],transfers:[{id:1,from_account_id:1,to_account_id:2,amount_cents:21500,description:'Opération bancaire',happened_on:'2026-10-23'}]});const row=pay(s,'2026-10-23');assert.equal(row.planned_cents,21500);assert.deepEqual(row.unmatched_payment_ids,[1]);assert.ok(s.warnings.some(w=>w.code==='card_payment_match'));
});
test('simple-card payment suggestions do not depend on an artificial opening debt balance',()=>{
 for(const balance_cents of [0,-999999,500000]){
  const s=run({accounts:[accounts[0],{...accounts[1],balance_cents,simple_credit:true}]});
  assert.equal(pay(s,'2026-10-23').planned_cents,23000);
  assert.equal(at(s,'2026-10-23').cash_cents,177000);
  assert.equal(at(s,'2026-10-23').safe_cents,177000);
 }
});
