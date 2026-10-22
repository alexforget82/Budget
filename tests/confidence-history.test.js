import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compareForecasts,createForecastHistory,forecastObservation} from '../forecast-history.js';
import {reconciliationHints} from '../reconciliation-hints.js';
const point=(date,cash,reserve=0)=>({date,cash_cents:cash,reserved_cents:reserve,safe_cents:cash-reserve});
test('minimum bridge is exact, including opening versus end-of-day and movement of its date',()=>{
 const before={date:'2026-10-22',points:[{...point('2026-10-22',10000),opening:true},point('2026-10-22',8000),point('2026-10-23',9000)]};
 const after={date:'2026-10-22',points:[{...point('2026-10-22',7000),opening:true},point('2026-10-22',9000),point('2026-10-23',9500)]};
 const c=compareForecasts(before,after,30);assert.equal(c.delta_cents,-1000);assert.equal(c.bridge.previous_at_date_cents,10000);
 assert.equal(c.delta_cents,c.bridge.cash_change_cents+c.bridge.reserve_change_cents+c.bridge.minimum_date_change_cents);
 const next={date:'2026-10-22',points:[{...point('2026-10-22',10000),opening:true},point('2026-10-22',9500),point('2026-10-23',9000,2500)]};
 const d=compareForecasts(before,next,30);assert.equal(d.after.cents,6500);assert.equal(d.delta_cents,d.bridge.cash_change_cents+d.bridge.reserve_change_cents+d.bridge.minimum_date_change_cents);
});
test('rolling horizon does not invent an equal-date explanation for an unseen date',()=>{
 const a={date:'2026-10-22',points:[point('2026-10-22',1000)]},b={date:'2026-10-23',points:[point('2026-10-23',900)]};
 const c=compareForecasts(a,b,30);assert.equal(c.window_changed,true);assert.equal(c.bridge,null);assert.equal(c.delta_cents,-100);
});
test('journal survives restart, ignores identical reads, bounds retention and clears on reset',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'history-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const service=()=>createForecastHistory({dir,today:()=> '2026-10-22',limit:3});let h=service();
 const state=n=>({cash_cents:n,reserved_cents:0,safe_cents:n,forecast:[point('2026-10-22',n)]}),tables=n=>({accounts:[{id:1,name:'Conjoint',balance_cents:n}]});
 h.observe(state(1000),tables(1000));h.observe(state(1000),tables(1000));assert.equal(h.read().records.length,1);
 for(let n=999;n>=995;n--)h.observe(state(n),tables(n),'/api/transactions');
 assert.equal(h.read().records.length,3);h=service();assert.equal(h.read().records[0].comparisons[30].delta_cents,-1);assert.ok(h.read().records[0].changes[0].label.includes('Conjoint'));
 h.reset();assert.equal(h.read().records.length,0);assert.equal(fs.existsSync(path.join(dir,'forecast-history.json')),false);
});
test('unreadable journal and failed persistence never throw into a ledger operation',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'history-fault-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'forecast-history.json'),'broken');
 const h=createForecastHistory({dir,today:()=> '2026-10-22'});assert.ok(h.read().error);assert.doesNotThrow(()=>h.observe({},{}));assert.equal(fs.readFileSync(path.join(dir,'forecast-history.json'),'utf8'),'broken');
 const blocked=path.join(dir,'file');fs.writeFileSync(blocked,'x');const other=createForecastHistory({dir:blocked,today:()=> '2026-10-22'});assert.doesNotThrow(()=>other.observe({cash_cents:0,reserved_cents:0,safe_cents:0,forecast:[]},{}));assert.ok(other.read().error);
});
test('reconciliation pairs and missing scheduled purchases respect bank/card signs and due dates',()=>{
 const transactions=[{id:1,amount_cents:-3000,affects_balance:1},{id:2,amount_cents:-2000,affects_balance:1},{id:3,amount_cents:-5000,affects_balance:0}];
 const out={delta_cents:5000,account:{id:1,kind:'checking'},since:'2026-10-01',transactions,transaction_count:3};
 assert.equal(reconciliationHints(out,[],'2026-10-22').pairs.length,1);
 assert.equal(reconciliationHints({...out,delta_cents:-5000},[],'2026-10-22').pairs.length,0);
 assert.equal(reconciliationHints({...out,delta_cents:-5000,account:{id:1,kind:'credit'}},[],'2026-10-22').pairs.length,1);
 const rows=[{description:'Apple',account_id:1,date:'2026-10-21',type:'expense',status:'planned',remaining_cents:5000},{account_id:1,date:'2026-10-23',type:'expense',status:'planned',remaining_cents:5000}];
 assert.equal(reconciliationHints({...out,delta_cents:-5000},rows,'2026-10-22').planned.length,1);
 assert.equal(reconciliationHints({...out,account:{id:1,kind:'credit'}},rows,'2026-10-22').planned.length,1);
 assert.equal(reconciliationHints({...out,delta_cents:0},rows,'2026-10-22').planned.length,0);
});

test('horizons remain distinct and composite period identities never overwrite each other',()=>{
 const days=Array.from({length:90},(_,i)=>point(new Date(Date.UTC(2026,9,22+i,12)).toISOString().slice(0,10),10000));
 const before={date:'2026-10-22',points:[{...days[0],opening:true},...days]},after=structuredClone(before);after.points[45].cash_cents=5000;after.points[45].safe_cents=5000;
 assert.equal(compareForecasts(before,after,30).delta_cents,0);assert.equal(compareForecasts(before,after,60).delta_cents,-5000);assert.equal(compareForecasts(before,after,90).delta_cents,-5000);
 const state={cash_cents:10000,reserved_cents:0,safe_cents:10000,forecast:days};const result=forecastObservation(state,{envelope_budget_overrides:[{envelope_id:1,occurrence_on:'2026-10-22',budget_cents:100},{envelope_id:1,occurrence_on:'2026-10-29',budget_cents:200}],envelope_actual_links:[{transaction_id:3,envelope_id:1,occurrence_on:'2026-10-22'},{transaction_id:4,envelope_id:1,occurrence_on:'2026-10-22'}]},'2026-10-22');assert.equal(Object.keys(result.inputs).length,4);
});
