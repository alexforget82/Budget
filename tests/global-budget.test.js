import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyEquivalent} from '../global-budget.js';
import {datesInBudgetMonth,validCalendarMetadata} from '../budget-calendar.js';
test('weekly and biweekly budgets count real calendar occurrences, never yearly averages',()=>{
 assert.equal(datesInBudgetMonth('2026-10-08','biweekly','2026-11').length,2);
 assert.equal(datesInBudgetMonth('2026-10-08','biweekly','2026-12').length,3);
 assert.equal(116805*datesInBudgetMonth('2026-10-08','biweekly','2026-11').length,233610);
 assert.equal(116805*datesInBudgetMonth('2026-10-08','biweekly','2026-12').length,350415);
 assert.equal(datesInBudgetMonth('2026-10-01','weekly','2026-11').length,4);
 assert.equal(datesInBudgetMonth('2026-10-01','weekly','2026-12').length,5);
 for(const f of ['weekly','biweekly'])assert.throws(()=>monthlyEquivalent(116805,f),/calendrier/);
});
test('calendar counting handles leap years, year boundaries, first occurrence and absent months',()=>{
 assert.equal(datesInBudgetMonth('2024-02-01','weekly','2024-02').length,5);
 assert.deepEqual(datesInBudgetMonth('2026-12-31','biweekly','2027-01'),['2027-01-14','2027-01-28']);
 assert.deepEqual(datesInBudgetMonth('2026-11-26','weekly','2026-11'),['2026-11-26']);
 assert.deepEqual(datesInBudgetMonth('2026-12-01','weekly','2026-11'),[]);
});
test('other frequencies retain their existing target conversion and cents validation',()=>{
 for(const [f,value]of Object.entries({monthly:23000,quarterly:7667,semiannual:3833,yearly:1917}))assert.equal(monthlyEquivalent(23000,f),value);
 assert.equal(monthlyEquivalent(1,'yearly'),0);assert.equal(monthlyEquivalent(100,'quarterly'),33);assert.equal(monthlyEquivalent(0,'monthly'),0);
 for(const n of [-1,NaN,Infinity,1.5,1e10+1])assert.throws(()=>monthlyEquivalent(n,'monthly'));
 for(const f of ['toString','__proto__','daily','',null])assert.throws(()=>monthlyEquivalent(100,f));
});
test('reference dates and saved calendar metadata are strict',()=>{
 for(const ref of ['2026-02-30','2026-2-01','bad',''])assert.throws(()=>datesInBudgetMonth(ref,'weekly','2026-11'));
 assert.equal(validCalendarMetadata({frequency:'weekly',reference_on:'2026-10-08'}),true);
 assert.equal(validCalendarMetadata({frequency:'biweekly',calendar_rule_id:1}),true);
 for(const p of [{frequency:'weekly',reference_on:'2026-02-30'},{frequency:'monthly',reference_on:'2026-10-08'},{frequency:'weekly',calendar_rule_id:0},{frequency:'weekly',calendar_rule_id:1,reference_on:'2026-10-08'}])assert.equal(validCalendarMetadata(p),false);
});
