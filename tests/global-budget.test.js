import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyEquivalent} from '../global-budget.js';
test('date-free targets use comparable monthly averages for every frequency',()=>{for(const [f,expected]of Object.entries({weekly:99667,biweekly:49833,monthly:23000,quarterly:7667,semiannual:3833,yearly:1917}))assert.equal(monthlyEquivalent(23000,f),expected,f);});
test('monthly target conversion rounds cents once and accepts zero',()=>{assert.equal(monthlyEquivalent(1,'yearly'),0);assert.equal(monthlyEquivalent(100,'quarterly'),33);assert.equal(monthlyEquivalent(0,'weekly'),0);});
test('invalid amounts and inherited frequency names are rejected',()=>{for(const n of [-1,NaN,Infinity,1.5,1e10+1])assert.throws(()=>monthlyEquivalent(n,'monthly'));for(const f of ['toString','__proto__','daily','',null])assert.throws(()=>monthlyEquivalent(100,f));});
