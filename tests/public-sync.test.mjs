import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergePublic} from '../public-sync.js';
const data=status=>({schemaVersion:1,applications:[{id:'role-one',company:'Example',role:'Intern',status}]});
test('published updates preserve notes, local overrides and deletions',()=>{
 let a=mergePublic([],{},data('Applied'));assert.equal(a.rows.length,1);
 a.rows[0].notes='private note';a.rows[0].priority='Top';
 let b=mergePublic(a.rows,a.baseline,data('Interviewing'));assert.equal(b.rows[0].status,'Interviewing');assert.equal(b.rows[0].notes,'private note');assert.equal(b.rows[0].priority,'Top');
 b.rows[0].status='Rejected';let c=mergePublic(b.rows,b.baseline,data('Needs Follow-up'));assert.equal(c.rows[0].status,'Rejected');
 assert.equal(mergePublic([],c.baseline,data('Applied'),['role-one']).rows.length,0);
 assert.equal(mergePublic(c.rows,c.baseline,{schemaVersion:1,applications:[]}).rows.length,1);
});
test('published data contains only authorized fields',async()=>{
 const data=JSON.parse(await readFile(new URL('../public-data.json',import.meta.url),'utf8'));
 assert.ok(data.applications.length>0);
 for(const r of data.applications){assert.deepEqual(Object.keys(r).sort(),['company','id','role','status']);assert.match(r.id,/^role-[a-f0-9]{20}$/);}
});
