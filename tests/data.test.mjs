import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED,validateRows,filteredRows,changeStatus,safeLink} from '../data.js';
const r={id:'sample',company:'Example Company',role:'Engineering Intern 2027',status:'To Apply',priority:'Top',history:[],appliedDate:''};
test('public build contains no personal seed data',()=>assert.deepEqual(SEED,[]));
test('validation and filtering compose',()=>{const rows=validateRows([r]);assert.equal(filteredRows(rows,{query:'engineering',priority:'Top'}).length,1);assert.equal(filteredRows(rows,{status:'Rejected'}).length,0);});
test('status transitions preserve unknown dates',()=>{const out=changeStatus(r,'Applied');assert.equal(out.hasApplied,true);assert.equal(out.appliedDate,'');});
test('unsafe links and malformed data are rejected',()=>{assert.equal(safeLink('javascript:alert(1)'),'');assert.throws(()=>validateRows([r,r]));assert.throws(()=>validateRows([{...r,status:'invalid'}]));});
