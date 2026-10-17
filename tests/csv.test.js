import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,bankAmount} from '../budget-features.js';

test('CSV handles BOM, quoted separators, doubled quotes, multiline cells and CRLF',()=>{
 const data=parseCSV('\uFEFFDate;Description;Montant\r\n2026-01-02;"Café; local";"-12,50"\r\n2026-01-03;"Note ""client""\nsuite";10');
 assert.equal(data.delimiter,';');assert.equal(data.rows.length,2);assert.equal(data.rows[0][1],'Café; local');assert.equal(data.rows[1][1],'Note "client"\nsuite');
});
test('CSV handles tabs and empty final columns',()=>{
 const data=parseCSV('Date\tDébit\tCrédit\n2026-01-01\t5\t');assert.equal(data.delimiter,'\t');assert.deepEqual(data.rows[0],['2026-01-01','5','']);
});
test('CSV rejects unterminated quotes, stray text, excessive rows and size',()=>{
 assert.throws(()=>parseCSV('A,B\n"bad,1'));assert.throws(()=>parseCSV('A,B\n"bad"text,1'));assert.throws(()=>parseCSV('A\n'+'1\n'.repeat(2001)));assert.throws(()=>parseCSV('x'.repeat(2_000_001)));
});
test('Localized amounts retain sign and exact cents',()=>{
 for(const [input,expected] of [['-12,50',-1250],['1 234,56 $',123456],['1,234.56',123456],['1.234,56',123456],['(25.50)',-2550],['25,50-',-2550],['0',0],['',null]])assert.equal(bankAmount(input),expected,input);
});
test('Amounts reject excess decimals, formulas, exponents and invalid separators',()=>{
 for(const value of ['1.234','=2+2','Infinity','1e3','1,2,3','abc','100000000'])assert.throws(()=>bankAmount(value),value);
});
