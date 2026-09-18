import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyncController} from '../cloud/controller.mjs';
const doc=()=>({schemaVersion:1,applications:[{id:'one',company:'Example',role:'Intern',status:'Applied',hasApplied:true,appliedDate:'',notes:'',priority:'Normal',history:[],updatedAt:''}],syncState:{seen:[],deleted:[],review:[],lastCheckedAt:'',public:{}}});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('edits made during a save survive and sync on the next pass',async()=>{
 let local=doc(),remote=doc(),revision=1,midSave=false;
 const c=createSyncController({account:'test',storage:memory(),getLocal:()=>structuredClone(local),applyLocal:v=>local=structuredClone(v),backend:{read:async()=>({revision,payload:remote}),write:async(expected,payload)=>{assert.equal(expected,revision);remote=payload;if(midSave){local.applications[0].notes='Typed during save';midSave=false;}return {revision:++revision};}}});
 await c.connect('cloud');local.applications[0].priority='Top';c.changed();midSave=true;await c.flush();
 assert.equal(local.applications[0].notes,'Typed during save');assert.equal(local.applications[0].priority,'Top');
 await c.flush();assert.equal(remote.applications[0].notes,'Typed during save');
});
test('a disconnected controller never applies an in-flight response',async()=>{
 let local=doc(),release;let reads=0;
 const c=createSyncController({account:'test',storage:memory(),getLocal:()=>local,applyLocal:v=>local=structuredClone(v),backend:{read:async()=>{if(++reads===1)return {revision:1,payload:doc()};return new Promise(r=>release=r);},write:async()=>assert.fail()}});
 await c.connect('cloud');const pending=c.flush();c.close();const changed=doc();changed.applications[0].notes='Remote';release({revision:2,payload:changed});await pending;assert.equal(local.applications[0].notes,'');
});
test('a new browser cannot upload automatically before choosing a copy',async()=>{
 let writes=0,state;
 const c=createSyncController({account:'test',storage:memory(),getLocal:doc,applyLocal:()=>assert.fail(),onState:s=>state=s,backend:{read:async()=>({revision:1,payload:doc()}),write:async()=>writes++}});
 await c.connect();await c.flush();assert.equal(state,'choose-copy');assert.equal(writes,0);
});
