// Pure reconciliation logic. Nothing is uploaded by this module.
const clone=value=>value===undefined?undefined:structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stateFields=['status','hasApplied','appliedDate','appliedDateSource'];
const group=row=>Object.fromEntries(stateFields.map(k=>[k,row[k]]));

export class SyncConflict extends Error {
 constructor(conflicts){super('Changes on both devices need review. Neither copy was overwritten.');this.name='SyncConflict';this.conflicts=conflicts;}
}

function reconcile(base,local,remote,path,conflicts){
 if(equal(local,remote))return clone(local);
 if(equal(local,base))return clone(remote);
 if(equal(remote,base))return clone(local);
 conflicts.push({path,base:clone(base),local:clone(local),remote:clone(remote)});
 return clone(local);
}

export function mergeSnapshots(base,local,remote){
 for(const doc of [base,local,remote]){
  if(doc?.schemaVersion!==1||!Array.isArray(doc.applications))throw Error('Invalid sync snapshot');
  const ids=doc.applications.map(r=>r.id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('Invalid or duplicate role IDs');
 }
 const conflicts=[], maps=[base,local,remote].map(d=>new Map(d.applications.map(r=>[r.id,r])));
 const applications=[];
 for(const id of new Set(maps.flatMap(m=>[...m.keys()]))){
  const [b,l,r]=maps.map(m=>m.get(id));
  let row;
  if(!b||!l||!r)row=reconcile(b,l,r,['applications',id],conflicts);
  else{
   row={id};
   Object.assign(row,reconcile(group(b),group(l),group(r),['applications',id,'applicationState'],conflicts));
   for(const field of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    if(field==='id'||stateFields.includes(field))continue;
    if(field==='history'){
     const entries=[...(l.history||[]),...(r.history||[])];
     row.history=[...new Map(entries.map(h=>[JSON.stringify(h),h])).values()];
    }else if(field==='updatedAt')row.updatedAt=[l.updatedAt||'',r.updatedAt||''].sort().at(-1);
    else row[field]=reconcile(b[field],l[field],r[field],['applications',id,field],conflicts);
   }
  }
  if(row)applications.push(row);
 }
 // Merge membership, including removal of tombstones when a deletion is undone.
 const syncState={};
 for(const field of ['seen','deleted']){
  const [b,l,r]=[base,local,remote].map(d=>new Set(d.syncState?.[field]||[]));
  syncState[field]=[...new Set([...b,...l,...r])].filter(value=>reconcile(b.has(value),l.has(value),r.has(value),['syncState',field,value],conflicts));
 }
 syncState.review=[...new Map([...(local.syncState?.review||[]),...(remote.syncState?.review||[])].map(v=>[JSON.stringify(v),v])).values()];
 syncState.lastCheckedAt=[local.syncState?.lastCheckedAt||'',remote.syncState?.lastCheckedAt||''].sort().at(-1);
 syncState.public={...(remote.syncState?.public||{}),...(local.syncState?.public||{})};
 if(conflicts.length)throw new SyncConflict(conflicts);
 return {schemaVersion:1,applications,syncState};
}

// read/write are authenticated backend operations. write must use an atomic
// expected-revision check; retry a concurrent update against the latest version.
export async function synchronize({base,local,read,write,maxAttempts=3}){
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const remote=await read();
  if(!Number.isSafeInteger(remote.revision)||remote.revision<0)throw Error('Invalid cloud revision');
  if(!base&&remote.payload)throw Error('INITIAL_CHOICE_REQUIRED');
  const payload=remote.payload?mergeSnapshots(base,local,remote.payload):clone(local);
  if(remote.payload&&equal(payload,remote.payload))return {revision:remote.revision,payload};
  try{
   const saved=await write(remote.revision,payload);
   if(saved.revision!==remote.revision+1)throw Error('Invalid save acknowledgement');
   return {revision:saved.revision,payload};
  }catch(error){if(error.code!=='40001')throw error;}
 }
 throw Error('Another device is still saving. Your local changes are safe; retry shortly.');
}
