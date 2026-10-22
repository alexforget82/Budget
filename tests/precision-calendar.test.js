import test from 'node:test';
import assert from 'node:assert/strict';
import {holidaySet, occurrenceInfo, shiftDate} from '../recurrence-calendar.js';
import {toCents} from '../money.js';
import {bankAmount} from '../budget-features.js';
test('entered amounts must have at most two effective decimal places',()=>{
 for(const v of [1.005,10.005,-1.005,0.001,1e-7,Infinity,NaN,'1.00',null,100000000])assert.equal(toCents(v),null,String(v));
 for(const [v,c] of [[1.01,101],[10.01,1001],[0.29,29],[19.99,1999],[-1.01,-101],[1e-2,1],[0,0],[99999999.99,9999999999]])assert.equal(toCents(v),c);
 for(const v of ['1.005','10.005','-1.005'])assert.throws(()=>bankAmount(v),/deux décimales/);
});
test('Christmas and Boxing Day never share their observed banking date',()=>{
 const days=holidaySet(2027);assert.ok(days.has('2027-12-27'));assert.ok(days.has('2027-12-28'));
 assert.equal(shiftDate('2027-12-25','after'),'2027-12-29');assert.equal(shiftDate('2027-12-28','before'),'2027-12-24');
 assert.ok(holidaySet(2022).has('2022-12-27'));assert.ok(holidaySet(2022).has('2022-12-26'));
});
test('bank holidays and actual last business day apply only to the selected schedule',()=>{
 assert.equal(shiftDate('2026-09-30','before'),'2026-09-29');assert.equal(shiftDate('2026-11-11','after'),'2026-11-12');
 for(const frequency of ['last_business_day','rrq'])assert.equal(occurrenceInfo('2026-09-01',frequency,0).date,'2026-09-29');
 assert.equal(occurrenceInfo('2026-09-30','monthly',0,'none').date,'2026-09-30');
 assert.equal(occurrenceInfo('2026-09-30','monthly',1,'none').date,'2026-10-30');
});
