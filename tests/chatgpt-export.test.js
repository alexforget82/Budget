import test from 'node:test';
import assert from 'node:assert/strict';
import {chatgptSnapshot} from '../chatgpt-export.js';
const today='2026-10-20';
const state={version:'test',safe_cents:77000,cash_cents:100000,private:{token:'PRIVATE_SECRET'},support41:{undo:{token:'UNDO_SECRET'}},accounts:[{id:1,name:'Conjoint',balance_cents:100000,secret:'NESTED_SECRET'}],envelopes:[{id:1,name:'Épicerie',reserved_cents:23000,secret:'ENV_SECRET'}],forecast:[{date:today,safe_cents:77000,cash_cents:100000,reserved_cents:23000,events:[{description:'Épicerie',sts_impact_cents:-23000,secret:'EVENT_SECRET'}]}],calendar_actuals:[{id:1,happened_on:'2026-10-19',amount_cents:-1000,description:'Récent'},{id:2,happened_on:'2026-01-01',amount_cents:-2000,description:'Ancien'}]};
test('financial snapshot excludes root and nested settings/tokens and preserves canonical cents',()=>{
 const out=chatgptSnapshot({state,today,budgets:[{month:'2026-10',secret:'BUDGET_SECRET',rows:[{id:1,budget_cents:23000,secret:'ROW_SECRET',subcategories:[{id:2,budget_cents:1000,secret:'SUB_SECRET'}]}]}]});
 assert.ok(!JSON.stringify(out).includes('SECRET'));assert.equal(out.current.safe_cents,77000);assert.equal(out.forecast[0].safe_cents,77000);assert.equal(out.budgets[0].rows[0].subcategories[0].budget_cents,1000);
 assert.equal(out.horizons[30].minimum_safe_cents,77000);assert.equal(out.metadata.transaction_count,1);assert.equal(out.metadata.history_from,'2026-07-23');assert.equal(out.metadata.forecast_to,today);
});
test('history options are explicit, untruncated and invalid scope is rejected',()=>{
 assert.equal(chatgptSnapshot({state,today,history:'365'}).transactions.length,2);
 assert.equal(chatgptSnapshot({state,today,history:'all'}).metadata.history_from,null);
 assert.throws(()=>chatgptSnapshot({state,today,history:'invalid'}));
});
