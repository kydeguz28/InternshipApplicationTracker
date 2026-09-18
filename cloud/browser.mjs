import {createCloudClient} from './client.mjs';
import {createSyncController} from './controller.mjs';
import {config} from './config.mjs';

export function startCloudSync({getLocal,applyLocal,canApply,download}){
 const panel=document.querySelector('#cloud-panel');
 const status=panel.querySelector('[data-cloud-status]');
 const message=panel.querySelector('[data-cloud-message]');
 const login=panel.querySelector('form');
 const choices=panel.querySelector('[data-cloud-choices]');
 const conflictBox=panel.querySelector('[data-cloud-conflicts]');
 const signout=panel.querySelector('[data-cloud-signout]');
 const retry=panel.querySelector('[data-cloud-retry]');
 const cloud=createCloudClient(config);
 let controller=null,account=null,applying=false,cloudCount=null,latestConflicts=[],timer;
 const guestKey='kyle.internships.guest-before-cloud.v1';
 const say=(heading,detail='')=>{status.textContent=heading;message.textContent=detail;};
 function state(kind,detail){
  choices.hidden=kind!=='choose-copy';conflictBox.hidden=kind!=='conflict';retry.hidden=!['error','storage-error'].includes(kind);
  if(kind==='choose-copy'){
   cloudCount=detail.cloudRoles;
   say('Choose your starting copy',`Cloud: ${cloudCount??0} roles. This browser: ${detail.localRoles} roles. Download a backup before replacing either copy.`);
   panel.querySelector('[data-use-cloud]').disabled=cloudCount===null;
  }else if(kind==='conflict'){
   latestConflicts=detail;
   say('Changes need your review','Both browsers changed the same information. Sync is paused; neither copy has been overwritten.');
   const list=panel.querySelector('[data-conflict-list]');list.replaceChildren();
   for(const c of detail){const li=document.createElement('li');const role=getLocal().applications.find(r=>r.id===c.path[1]);li.textContent=(role?`${role.company} — ${role.role}: `:'')+c.path.at(-1);list.append(li);}
  }else if(kind==='synced')say('Synced across browsers','Signed in as '+account.email+'. Changes sync automatically while this page is open.');
  else if(kind==='pending')say('Saved here · waiting to sync','Your edits are saved on this browser.');
  else if(kind==='syncing')say('Syncing…','Your local copy stays available.');
  else if(kind==='storage-error')say('Browser storage is full','Export a backup before continuing. Cloud sync is paused.');
  else if(kind==='error')say('Sync paused · local edits are safe',detail?.code==='42501'?'This email is not enrolled for this tracker. Sign in with your enrolled address.':'Check your connection, then retry. If your session expired, sign out and sign in again.');
 }
 const apply=doc=>{applying=true;try{applyLocal(doc);}finally{applying=false;}};
 async function sessionChanged(session){
  const user=session?.user;
  if(user?.id===account?.id&&controller)return;
  const previousAccount=account;
  controller?.close();controller=null;account=user||null;
  signout.hidden=!account;login.hidden=!!account;choices.hidden=true;conflictBox.hidden=true;
  if(!account){
   const guest=localStorage.getItem(guestKey);
   if(guest&&previousAccount)apply(JSON.parse(guest));
   say('Sync your browsers','Sign in with the same email in Chrome and here. No Gmail access is used.');return;
  }
  if(!localStorage.getItem(guestKey))localStorage.setItem(guestKey,JSON.stringify(getLocal()));
  controller=createSyncController({account:user.id,storage:localStorage,backend:cloud.backend,getLocal,applyLocal:apply,canApply,onState:state});
  try{await controller.connect();}catch(e){state('error',e);}
 }
 login.onsubmit=async e=>{
  e.preventDefault();const email=login.elements.email.value.trim();const button=login.querySelector('button[type=submit]');button.disabled=true;
  try{
   const {error}=await cloud.auth.signInWithOtp({email,options:{emailRedirectTo:'https://kydeguz28.github.io/InternshipApplicationTracker/'}});
   if(error)throw error;
   say('Check your email','Open the sign-in link in this browser. If email opens it in Chrome, copy the link into the browser you want to sync. Request a separate link for each browser.');
  }catch(e){say('Could not send the sign-in email',e.status===429?'Please wait a minute before trying again.':'Check the address and try again. If delivery is restricted, use the email registered with your Supabase account.');}
  finally{button.disabled=false;}
 };
 signout.onclick=async()=>{
  if(!confirm('Sign out? Any unsynced edits remain in this browser’s account backup.'))return;
  const {error}=await cloud.auth.signOut({scope:'local'});if(error)say('Sign-out failed','Check your connection and try again.');
 };
 retry.onclick=()=>controller?.flush();
 panel.querySelector('[data-use-cloud]').onclick=async()=>{
  if(!confirm('Use the cloud copy in this browser? Your current copy will also be retained as a local recovery backup.'))return;
  try{await controller?.connect('cloud');}catch(e){state('error',e);}
 };
 panel.querySelector('[data-use-local]').onclick=async()=>{
  if(!confirm(`Use this browser’s ${getLocal().applications.length} roles as the cloud copy${cloudCount!==null?', replacing its '+cloudCount+' roles':''}?`))return;
  try{await controller?.connect('local');}catch(e){state('error',e);}
 };
 panel.querySelector('[data-download-local]').onclick=()=>download(JSON.stringify(getLocal(),null,2),'tracker-before-sync.json');
 panel.querySelector('[data-download-conflicts]').onclick=()=>download(JSON.stringify({applications:getLocal().applications,conflicts:latestConflicts},null,2),'tracker-sync-conflicts.json');
 for(const button of panel.querySelectorAll('[data-resolve]'))button.onclick=async()=>{
  const choice=button.dataset.resolve;
  if(!confirm(choice==='local'?'Replace the full cloud copy with this browser’s copy? Download the conflict backup first.':'Replace this browser’s copy with the cloud copy? Download the conflict backup first.'))return;
  try{await controller?.resolve(choice);}catch(e){state('error',e);}
 };
 cloud.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>sessionChanged(session).catch(e=>state('error',e)),0);});
 cloud.auth.getSession().then(({data,error})=>{if(error)state('error',error);else return sessionChanged(data.session);}).catch(e=>state('error',e));
 setInterval(()=>controller?.flush(),10000);
 window.addEventListener('online',()=>controller?.flush());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)controller?.flush();});
 document.querySelector('#editor').addEventListener('close',()=>controller?.flush());
 window.addEventListener('storage',e=>{
  if(account&&e.key==='kyle.internships.cloud.v1.'+account.id){
   // Never let two tabs silently replace one another's unsynced work.
   controller?.close();controller=null;say('Tracker changed in another tab','Reload this tab to use its latest saved copy.');
  }
 });
 return {get active(){return !!account;},changed(){if(applying)return;controller?.changed();clearTimeout(timer);timer=setTimeout(()=>controller?.flush(),700);}};
}
