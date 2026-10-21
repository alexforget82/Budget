import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardEnvelopeFunds} from '../card-envelope-funds.js';
import {buildForecast} from '../forecast-engine.js';
const accounts=[{id:1,name:'Conjoint',kind:'checking',included:1,balance_cents:100000},{id:2,name:'CIBC',kind:'credit',included:0,balance_cents:500000},{id:3,name:'Visa',kind:'credit',included:0,balance_cents:100000}];
const tx=(id,amount,envelope=1,card=2,on='2026-10-22')=>({id,account_id:card,envelope_id:envelope,amount_cents:amount,happened_on:on,affects_balance:1});
const payment=(id,amount,card=2,on='2026-10-23')=>({id,from_account_id:1,to_account_id:card,amount_cents:amount,happened_on:on});
const fund=extra=>createCardEnvelopeFunds({accounts,today:'2026-10-24',...extra});
test('only real envelope purchases are protected, never opening card debt, unassigned spending or historical imports',()=>{assert.equal(fund({}).total(),0);const f=fund({transactions:[tx(1,-10000),tx(2,-2000,null),{...tx(3,-3000),affects_balance:0},tx(4,-4000,1,1)]});assert.equal(f.total(),10000);});
test('partial repayments release the oldest protected purchases on the same card only',()=>{const f=fund({transactions:[tx(1,-10000,1),tx(2,-6000,2),tx(3,-4000,3,3)],transfers:[payment(1,12000)]});assert.deepEqual(f.entries(),[{card_account_id:2,envelope_id:2,amount_cents:4000},{card_account_id:3,envelope_id:3,amount_cents:4000}]);assert.equal(f.pay(2,99999),4000);assert.equal(f.total(),4000);});
test('card refunds reduce the protected obligation and overpayments never produce negative protection',()=>{const f=fund({transactions:[tx(1,-10000),tx(2,2500,null)]});assert.equal(f.total(),7500);assert.equal(f.pay(2,12000),7500);assert.equal(f.total(),0);});
test('a reconciled zero card balance or card credit cannot retain a phantom obligation',()=>{for(const balance_cents of [0,-5000])assert.equal(fund({accounts:[accounts[0],{...accounts[1],balance_cents}],transactions:[tx(1,-10000)]}).total(),0);assert.equal(fund({accounts:[accounts[0],{...accounts[1],balance_cents:3000}],transactions:[tx(1,-10000)]}).total(),3000);});
test('same-day repayments cover the same-day assigned purchase regardless of entry order',()=>{const f=fund({transactions:[tx(3,-23000)],transfers:[payment(1,23000,2,'2026-10-22')]});assert.equal(f.total(),0);});
function nextOccurrence(start,frequency,i){const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i*7);return d.toISOString().slice(0,10);}
const env={id:1,name:'Épicerie',active:1,frequency:'weekly',start_on:'2026-10-22',budget_cents:23000,reserved_cents:0,forecast_spend:1,forecast_account_id:2,rollover:0,planning_since:'2026-10-17'};
const simulate=extra=>buildForecast({accounts,envelopes:[env],recurring:[],today:'2026-10-17',since:'2026-10-17',nextOccurrence,occurrenceInfo:(s,f,i)=>({date:nextOccurrence(s,f,i)}),similarDescription:(a,b)=>a===b,...extra});
const at=(s,on)=>s.days.find(d=>d.date===on);
test('230 weekly on CIBC stays protected before any payment and accumulates across weeks',()=>{const s=simulate();assert.equal(at(s,'2026-10-21').safe_cents,100000);for(const [on,safe] of [['2026-10-22',77000],['2026-10-29',54000],['2026-11-05',31000]]){const d=at(s,on);assert.equal(d.cash_cents,100000);assert.equal(d.safe_cents,safe);assert.equal(d.reserved_cents,100000-safe);assert.equal(d.credit_reserved_cents,0);}});
test('same-day projected card payment consumes the protected amount without another Safe-to-Spend deduction',()=>{const rule={id:1,type:'transfer',description:'Paiement CIBC',active:1,amount_cents:23000,account_id:1,to_account_id:2,start_on:'2026-10-22',frequency:'weekly'};const s=simulate({recurring:[rule]});for(const [on,cash] of [['2026-10-22',77000],['2026-10-29',54000]]){const d=at(s,on);assert.equal(d.cash_cents,cash);assert.equal(d.safe_cents,cash);assert.equal(d.card_envelope_reserved_cents,0);}});
test('every date reconciles bank cash, unused envelopes and protected card purchases',()=>{const s=simulate();for(const d of s.days){const b=d.bridge;assert.equal(b.opening_cash_cents+b.income_cents+b.expense_cents+b.envelope_cents+b.transfer_cents,d.cash_cents);assert.equal(d.envelope_reserved_cents+d.card_envelope_reserved_cents,d.reserved_cents);assert.equal(d.cash_cents-d.reserved_cents,d.safe_cents);}});
test('an ordinary purchase before the first period cannot consume that future allocation',()=>{
 for(const account of [1,2])for(const mode of [0,1]){
  const envelope={...env,name:'Essence Alex',start_on:'2026-10-27',budget_cents:6000,forecast_spend:mode,forecast_account_id:account};
  const transactions=[tx(1,-6000,1,account,'2026-10-20')];
  const result=simulate({today:'2026-10-21',envelopes:[envelope],transactions});
  const event=at(result,'2026-10-27').events.find(e=>e.envelope_renewal);
  assert.equal(event.amount_cents,6000);
  const linked=simulate({today:'2026-10-21',envelopes:[envelope],transactions,envelopeLinks:[{transaction_id:1,envelope_id:1,occurrence_on:'2026-10-27'}]});
  if(account===2||mode===0)assert.equal(at(linked,'2026-10-27').events.find(e=>e.envelope_renewal).amount_cents,0);
 }
});
