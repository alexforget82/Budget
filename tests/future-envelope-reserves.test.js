import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForecast} from '../forecast-engine.js';
import {nextOccurrence,occurrenceInfo} from '../recurrence-calendar.js';
const today='2026-10-20',start='2026-10-22';
function simulate(envelope={},extra={}){
 return buildForecast({today,accounts:[{id:1,kind:'checking',included:1,balance_cents:100000}],envelopes:[{id:1,name:'Épicerie',reserved_cents:0,budget_cents:23000,frequency:'weekly',start_on:start,rollover:0,active:1,forecast_spend:0,...envelope}],recurring:[],nextOccurrence,occurrenceInfo,similarDescription:()=>false,...extra});
}
test('each future protected period reserves its own amount, without changing bank balances',()=>{
 for(const frequency of ['weekly','biweekly','monthly','quarterly','semiannual','yearly']){
  const result=simulate({frequency},{horizon:750});
  for(let i=0;i<3;i++){
   const day=result.days.find(d=>d.date===nextOccurrence(start,frequency,i));
   assert.equal(day.cash_cents,100000,frequency);
   assert.equal(day.reserved_cents,(i+1)*23000,frequency);
   assert.equal(day.safe_cents,100000-(i+1)*23000,frequency);
  }
 }
});
test('October 28 to 29 protects another 230 dollars even when rollover is off',()=>{
 const result=simulate();
 assert.equal(result.days.find(d=>d.date==='2026-10-28').safe_cents,77000);
 const next=result.days.find(d=>d.date==='2026-10-29');
 assert.equal(next.safe_cents,54000);
 assert.equal(next.events.find(e=>e.envelope_renewal).sts_impact_cents,-23000);
});
test('funding in advance only covers the designated period, including partial funding',()=>{
 for(const credit of [10000,23000]){
  const result=simulate({reserved_cents:credit,advance_funding:{[start]:{amount_cents:credit,remaining_cents:credit}}});
  assert.equal(result.days[0].safe_cents,100000-credit);
  assert.equal(result.days.find(d=>d.date===start).safe_cents,77000);
  assert.equal(result.days.find(d=>d.date==='2026-10-29').safe_cents,54000);
 }
});
test('dated purchases still consume their reservation once rather than adding two expenses',()=>{
 const result=simulate({forecast_spend:1,forecast_account_id:1});
 for(const date of [start,'2026-10-29']){
  const d=result.days.find(d=>d.date===date),i=date===start?1:2;
  assert.equal(d.safe_cents,100000-i*23000);
  assert.equal(d.cash_cents,100000-i*23000);
  assert.equal(d.reserved_cents,0);
 }
});
test('a planned bank expense attached to a protected envelope consumes its reservation once',()=>{
 const result=simulate({}, {recurring:[{id:1,active:1,type:'expense',description:'Courses prévues',account_id:1,envelope_id:1,start_on:start,frequency:'weekly',amount_cents:23000}]});
 const d=result.days.find(d=>d.date==='2026-10-29');
 assert.equal(d.cash_cents,54000);assert.equal(d.safe_cents,54000);assert.equal(d.reserved_cents,0);
});
test('period exceptions, zero allocations and stopped schedules remain authoritative',()=>{
 const result=simulate({budget_schedules:[{from_month:'2026-10',start_on:start,frequency:'weekly',period_amount_cents:23000,repeat_monthly:false}]},{envelopeOverrides:[{envelope_id:1,occurrence_on:'2026-10-29',budget_cents:10000}]});
 assert.equal(result.days.find(d=>d.date==='2026-10-29').safe_cents,67000);
 assert.equal(result.days.at(-1).safe_cents,67000);
 const zero=simulate({}, {envelopeOverrides:[{envelope_id:1,occurrence_on:'2026-10-29',budget_cents:0}]});
 assert.equal(zero.days.find(d=>d.date==='2026-10-29').safe_cents,77000);
});
test('early bank/card purchases use the same period budget even without advance funding',()=>{
 for(const card of [false,true])for(const credit of [0,10000,23000]){
  const effect=Math.min(credit,10000),accountId=card?2:1;
  const result=simulate({reserved_cents:credit-effect,...(credit?{advance_funding:{[start]:{amount_cents:credit,remaining_cents:credit-effect}}}:{})},{accounts:[{id:1,kind:'checking',included:1,balance_cents:card?100000:90000},...(card?[{id:2,kind:'credit',included:0,balance_cents:10000}]:[])],transactions:[{id:1,account_id:accountId,envelope_id:1,amount_cents:-10000,envelope_effect_cents:effect,happened_on:today,affects_balance:1}]});
  assert.equal(result.days.find(d=>d.date===start).safe_cents,77000,JSON.stringify({card,credit}));
  assert.equal(result.days.find(d=>d.date==='2026-10-29').safe_cents,54000);
 }
});
