import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForecast} from '../forecast-engine.js';
import {nextOccurrence,occurrenceInfo} from '../recurrence-calendar.js';
const today='2026-10-20',start='2026-10-22';
const frequencies=['weekly','biweekly','monthly','quarterly','semiannual','yearly'];
const accounts=[{id:1,kind:'checking',included:1,balance_cents:1000000},...[2,3,4].map(id=>({id,kind:'credit',included:0,balance_cents:0}))];
function forecast(envelope,extra={}){
 return buildForecast({today,horizon:750,accounts,envelopes:[{id:1,name:'Enveloppe vérifiée',reserved_cents:0,budget_cents:23000,frequency:'weekly',start_on:start,rollover:0,active:1,forecast_spend:0,...envelope}],recurring:[],nextOccurrence,occurrenceInfo,similarDescription:()=>false,...extra});
}
let cases=0;
test('all six frequencies, both rollover settings, both envelope modes and all four payment accounts protect each period',()=>{
 for(const frequency of frequencies)for(const rollover of [0,1])for(const forecast_spend of [0,1])for(const forecast_account_id of [1,2,3,4]){
  const result=forecast({frequency,rollover,forecast_spend,forecast_account_id});
  const name=JSON.stringify({frequency,rollover,forecast_spend,forecast_account_id});
  for(let i=0;i<3;i++){
   const day=result.days.find(d=>d.date===nextOccurrence(start,frequency,i));
   assert.equal(day.safe_cents,1000000-(i+1)*23000,name);
   assert.equal(day.cash_cents,forecast_spend&&forecast_account_id===1?1000000-(i+1)*23000:1000000,name);
  }
  cases++;
 }
 assert.equal(cases,96);
});
test('partial and full advances cover only one occurrence for every frequency and rollover setting',()=>{
 for(const frequency of frequencies)for(const rollover of [0,1])for(const credit of [10000,23000]){
  const result=forecast({frequency,rollover,reserved_cents:credit,advance_funding:{[start]:{amount_cents:credit,remaining_cents:credit}}});
  assert.equal(result.days[0].safe_cents,1000000-credit);
  for(let i=0;i<3;i++)assert.equal(result.days.find(d=>d.date===nextOccurrence(start,frequency,i)).safe_cents,1000000-(i+1)*23000);
 }
});
test('explicit early actual purchases on Joint and each card are counted once, with or without advance funding',()=>{
 for(const frequency of frequencies)for(const rollover of [0,1])for(const account_id of [1,2,3,4])for(const credit of [0,10000,23000]){
  const effect=Math.min(credit,10000),bank=account_id===1;
  const result=forecast({frequency,rollover,reserved_cents:credit-effect,...(credit?{advance_funding:{[start]:{amount_cents:credit,remaining_cents:credit-effect}}}:{})},{accounts:accounts.map(a=>({...a,balance_cents:a.id===1?1000000-(bank?10000:0):a.id===account_id?10000:0})),envelopeLinks:[{transaction_id:1,envelope_id:1,occurrence_on:start}],transactions:[{id:1,account_id,envelope_id:1,amount_cents:-10000,envelope_effect_cents:effect,happened_on:today,affects_balance:1}]});
  const name=JSON.stringify({frequency,rollover,account_id,credit});
  for(let i=0;i<3;i++)assert.equal(result.days.find(d=>d.date===nextOccurrence(start,frequency,i)).safe_cents,1000000-(i+1)*23000,name);
 }
});
test('category-managed schedules and exceptional amounts protect each period, including annual schedules',()=>{
 for(const frequency of frequencies)for(const rollover of [0,1]){
  const second=nextOccurrence(start,frequency,1),third=nextOccurrence(start,frequency,2);
  const result=forecast({frequency,rollover,budget_schedules:[{from_month:'2026-10',start_on:start,frequency,period_amount_cents:23000,repeat_monthly:true}]},{envelopeOverrides:[{envelope_id:1,occurrence_on:second,budget_cents:10000},{envelope_id:1,occurrence_on:third,budget_cents:0}]});
  assert.equal(result.days.find(d=>d.date===start).safe_cents,977000);
  assert.equal(result.days.find(d=>d.date===second).safe_cents,967000);
  assert.equal(result.days.find(d=>d.date===third).safe_cents,967000);
 }
});
test('mixed envelopes accumulate independently without sharing an allocation',()=>{
 const envelopes=[{id:1,name:'Épicerie',budget_cents:23000,frequency:'weekly'},{id:2,name:'Essence Alex',budget_cents:6000,frequency:'weekly'},{id:3,name:'Restaurant',budget_cents:12500,frequency:'monthly'},{id:4,name:'Pharmacie',budget_cents:5000,frequency:'monthly'},{id:5,name:'Nouvelle enveloppe',budget_cents:1700,frequency:'biweekly'}].map(e=>({...e,reserved_cents:0,start_on:start,rollover:0,active:1,forecast_spend:0}));
 const result=forecast({}, {envelopes});
 for(const day of result.days){
  let expected=0;
  for(const e of envelopes)for(let i=0;i<1000;i++){const on=nextOccurrence(start,e.frequency,i);if(on>day.date)break;expected+=e.budget_cents;}
  assert.equal(day.reserved_cents,expected,day.date);assert.equal(day.safe_cents,1000000-expected,day.date);assert.equal(day.cash_cents,1000000);
 }
});
test('free and paused envelopes keep current reserves without inventing future allocations',()=>{
 for(const setting of [{frequency:'none',budget_cents:0,start_on:null},{active:0}]){
  const result=forecast({...setting,reserved_cents:20000});
  assert.ok(result.days.every(d=>d.safe_cents===980000&&d.reserved_cents===20000&&d.cash_cents===1000000));
 }
});
test('scheduled allowances transferred from Joint to a personal account protect each period once',()=>{
 for(const frequency of frequencies)for(const rollover of [0,1])for(const forecast_spend of [0,1]){
  const result=forecast({frequency,rollover,forecast_spend,forecast_account_id:5},{accounts:[...accounts,{id:5,kind:'checking',included:0,balance_cents:0}]});
  for(let i=0;i<3;i++)assert.equal(result.days.find(d=>d.date===nextOccurrence(start,frequency,i)).safe_cents,1000000-(i+1)*23000);
 }
});
test('an envelope automatic renewal supersedes a duplicate recurring reserve',()=>{
 const result=forecast({}, {recurring:[{id:1,active:1,type:'reserve',description:'Ancienne réserve programmée',envelope_id:1,start_on:start,frequency:'weekly',amount_cents:23000}]});
 assert.equal(result.days.find(d=>d.date===start).safe_cents,977000);
 assert.equal(result.days.find(d=>d.date==='2026-10-29').safe_cents,954000);
 assert.ok(result.rows.every(r=>r.description!=='Ancienne réserve programmée'));
});
