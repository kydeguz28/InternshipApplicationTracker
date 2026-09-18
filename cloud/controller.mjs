import {mergeSnapshots,synchronize,SyncConflict} from './merge.mjs';

// One instance belongs to one authenticated account. UI owns polling and auth.
export function createSyncController({account,storage,backend,getLocal,applyLocal,canApply=()=>true,onState=()=>{}}){
 const key='kyle.internships.cloud.v1.'+account;
 let base=null,ready=false,busy=false,closed=false,conflict=null;
 const store=(baseline,local)=>storage.setItem(key,JSON.stringify({base:baseline,local}));
 function changed(){
  if(!ready||closed)return;
  try{store(base,getLocal());onState('pending');}catch{ready=false;onState('storage-error');}
 }
 async function connect(choice){
  if(closed)throw Error('Session closed');
  const cache=storage.getItem(key);
  if(cache&&!choice){
   const saved=JSON.parse(cache);
   if(!saved.local?.applications||!saved.base?.applications)throw Error('Cloud recovery data is invalid. Export before continuing.');
   base=saved.base;applyLocal(saved.local);ready=true;return flush();
  }
  const remote=await backend.read();
  if(closed)return;
  if(!choice){onState('choose-copy',{cloudRoles:remote.payload?.applications.length??null,localRoles:getLocal().applications.length});return;}
  // Retain the replaced browser snapshot as a local recovery copy.
  storage.setItem(key+'.before-connect',JSON.stringify(getLocal()));
  if(choice==='cloud'){
   if(!remote.payload)throw Error('No cloud copy exists yet.');
   store(remote.payload,remote.payload);base=remote.payload;applyLocal(remote.payload);ready=true;onState('synced');
  }else if(choice==='local'){
   // The UI explicitly confirms replacement if a cloud copy already exists.
   base=remote.payload||{schemaVersion:1,applications:[],syncState:{}};
   store(base,getLocal());ready=true;await flush();
  }else throw Error('Choose browser or cloud copy');
 }
 async function flush(){
  if(!ready||busy||closed||conflict||!canApply())return;
  busy=true;onState('syncing');
  const sent=structuredClone(getLocal());
  try{
   const saved=await synchronize({base,local:sent,read:backend.read,write:backend.write});
   if(closed)return;
   // Defer visual replacement while a role editor is open; retry on close.
   if(!canApply()){onState('pending');return;}
   const now=getLocal();
   const next=mergeSnapshots(sent,now,saved.payload);
   store(saved.payload,next);base=saved.payload;applyLocal(next);
   onState(JSON.stringify(next)===JSON.stringify(saved.payload)?'synced':'pending');
  }catch(error){
   if(closed)return;
   if(error instanceof SyncConflict){conflict=error;onState('conflict',error.conflicts);}
   else onState('error',error);
  }finally{busy=false;}
 }
 async function resolve(choice){
  if(!conflict||closed)return;
  if(choice==='cloud'){
   const remote=await backend.read();
   if(closed)return;
   if(!remote.payload)throw Error('Cloud copy unavailable');
   storage.setItem(key+'.before-resolution',JSON.stringify(getLocal()));
   store(remote.payload,remote.payload);base=remote.payload;applyLocal(remote.payload);conflict=null;onState('synced');
  }else if(choice==='local'){
   const remote=await backend.read();
   if(closed)return;
   storage.setItem(key+'.before-resolution',JSON.stringify(remote.payload));
   base=remote.payload||{schemaVersion:1,applications:[],syncState:{}};
   conflict=null;store(base,getLocal());await flush();
  }else throw Error('Choose browser or cloud copy');
 }
 return {connect,changed,flush,resolve,close(){closed=true;ready=false;},get ready(){return ready;}};
}
