import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshots,synchronize,SyncConflict} from '../cloud/merge.mjs';
const snapshot=()=>({schemaVersion:1,applications:[{id:'one',company:'Example',role:'Intern',status:'To Apply',hasApplied:false,appliedDate:'',notes:'',priority:'Normal',history:[]}],syncState:{seen:[],deleted:[],public:{},review:[],lastCheckedAt:''}});

test('independent edits from two devices both survive',()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);
 local.applications[0].notes='Interview preparation';remote.applications[0].priority='Top';
 const merged=mergeSnapshots(base,local,remote);
 assert.equal(merged.applications[0].notes,'Interview preparation');assert.equal(merged.applications[0].priority,'Top');
});
test('conflicting statuses require review without changing inputs',()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);
 local.applications[0].status='Applied';remote.applications[0].status='Rejected';
 assert.throws(()=>mergeSnapshots(base,local,remote),SyncConflict);
 assert.equal(local.applications[0].status,'Applied');assert.equal(remote.applications[0].status,'Rejected');
});
test('deletion syncs, but deletion versus a new edit needs review',()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);
 local.applications=[];local.syncState.deleted=['one'];
 assert.equal(mergeSnapshots(base,local,remote).applications.length,0);
 remote.applications[0].notes='New information';assert.throws(()=>mergeSnapshots(base,local,remote),SyncConflict);
});
test('an undone deletion clears its tombstone',()=>{
 const base=snapshot();base.applications=[];base.syncState.deleted=['one'];
 const local=snapshot(),remote=structuredClone(base);
 const merged=mergeSnapshots(base,local,remote);assert.equal(merged.applications.length,1);assert.deepEqual(merged.syncState.deleted,[]);
});
test('simultaneous additions are preserved and duplicate IDs rejected',()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);
 local.applications.push({...local.applications[0],id:'two'});remote.applications.push({...remote.applications[0],id:'three'});
 assert.equal(mergeSnapshots(base,local,remote).applications.length,3);
 local.applications.push(local.applications[0]);assert.throws(()=>mergeSnapshots(base,local,remote),/duplicate/);
});
test('a concurrent save is re-read and merged before retry',async()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);local.applications[0].notes='Local';
 let revision=1,calls=0;
 const result=await synchronize({base,local,read:async()=>({revision,payload:structuredClone(remote)}),write:async(expected,payload)=>{
  if(++calls===1){revision=2;remote.applications[0].priority='Top';throw Object.assign(Error('Conflict'),{code:'40001'});}
  assert.equal(expected,2);assert.equal(payload.applications[0].notes,'Local');assert.equal(payload.applications[0].priority,'Top');return {revision:3};
 }});
 assert.equal(result.revision,3);assert.equal(calls,2);
});
test('first connection to an existing cloud copy requires a migration choice',async()=>{
 let writes=0;await assert.rejects(synchronize({base:null,local:snapshot(),read:async()=>({revision:1,payload:snapshot()}),write:async()=>{writes++;}}),/INITIAL_CHOICE_REQUIRED/);assert.equal(writes,0);
});
test('network failure does not report success or discard offline changes',async()=>{
 const local=snapshot();local.applications[0].notes='Offline edit';
 await assert.rejects(synchronize({base:snapshot(),local,read:async()=>{throw Error('Offline');},write:async()=>assert.fail('Should not write')}),/Offline/);
 assert.equal(local.applications[0].notes,'Offline edit');
});
