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
 for(const r of data.applications){assert.ok(Object.keys(r).every(k=>['company','id','role','status','link','linkLabel','linkNote'].includes(k)));if(r.link){assert.equal(new URL(r.link).protocol,'https:');assert.ok(['Posting','Posting copy','Possible match','Careers'].includes(r.linkLabel));}assert.match(r.id,/^role-[a-f0-9]{20}$/);}
});

test('public links reach existing records and preserve local URLs',()=>{
 const payload=data('Applied');
 payload.applications[0]={...payload.applications[0],link:'https://example.org/job/1',linkLabel:'Posting',linkNote:'Matching title'};
 const existing={...data('Applied').applications[0],priority:'Top',notes:'Private',link:''};
 const first=mergePublic([existing],{'role-one':{status:'Applied'}},payload);
 assert.equal(first.rows.length,1);assert.equal(first.rows[0].link,payload.applications[0].link);
 assert.equal(first.rows[0].linkNote,'Matching title');assert.equal(first.rows[0].notes,'Private');
 payload.applications[0].link='https://example.org/job/2';
 payload.applications[0].linkLabel='Careers';
 const updated=mergePublic(first.rows,first.baseline,payload);
 assert.equal(updated.rows[0].link,'https://example.org/job/2');assert.equal(updated.rows[0].linkLabel,'Careers');
 updated.rows[0].link='https://my.example/saved';updated.rows[0].linkLabel='My link';
 const custom=mergePublic(updated.rows,updated.baseline,payload);
 assert.equal(custom.rows[0].link,'https://my.example/saved');assert.equal(custom.rows[0].linkLabel,'My link');
 const empty=mergePublic(custom.rows,custom.baseline,data('Applied'));
 assert.equal(empty.rows[0].link,'https://my.example/saved');
});

test('published catalog covers submitted roles and contains no private fields',async()=>{
 const published=JSON.parse(await readFile(new URL('../public-data.json',import.meta.url),'utf8'));
 const catalog=JSON.parse(await readFile(new URL('../role-links.json',import.meta.url),'utf8'));
 for(const row of published.applications){
  {assert.ok(row.link);assert.deepEqual(catalog[row.id],{link:row.link,linkLabel:row.linkLabel,linkNote:row.linkNote});}
 }
 for(const entry of Object.values(catalog))assert.deepEqual(Object.keys(entry).sort(),['link','linkLabel','linkNote']);
});

test("every published To Apply role has a specific posting link",async()=>{
 const data=JSON.parse(await readFile(new URL("../public-data.json",import.meta.url),"utf8"));
 for(const row of data.applications.filter(r=>r.status==="To Apply")){assert.ok(row.link);assert.ok(["Posting","Posting copy"].includes(row.linkLabel));}
});
