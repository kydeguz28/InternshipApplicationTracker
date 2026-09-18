import {startCloudSync} from './cloud-sync.js?v=cloud-sync-2';
import {mergePublic} from './public-sync.js';
import {mergeFeed,emptySyncState,normalizeSyncState} from './sync.js';
import {SEED,STATUSES,PRIORITIES,validateRows,filteredRows,changeStatus,safeLink} from './data.js';
const hosted=document.body.dataset.hosting==='static';
const $=s=>document.querySelector(s), KEY='kyle.internships.v1', esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), cls=s=>s.toLowerCase().replaceAll(' ','-');
let cloudUI=null;
let syncState=emptySyncState(),undoSync=null,syncBusy=false,snapshotQueue=Promise.resolve();
let rows=structuredClone(SEED),loadError='',view='All applications',format='table',undo=null,toastTimer;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.schemaVersion!==1)throw Error('Unsupported backup version');rows=validateRows(parsed.applications);syncState=normalizeSyncState(parsed.syncState);}}catch(e){loadError='Saved data could not be loaded. Export recovery data before making changes.';}
const options=(values,current='')=>values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');
$('#status-filter').innerHTML='<option value="">All statuses</option>'+options(STATUSES);$('#priority-filter').innerHTML='<option value="">All priorities</option>'+options(PRIORITIES);
const form=$('#role-form');form.elements.status.innerHTML=options(STATUSES);form.elements.priority.innerHTML=options(PRIORITIES);
function toast(message,canUndo=false){clearTimeout(toastTimer);$('#toast').hidden=false;$('#toast').textContent=message;if(canUndo){const b=document.createElement('button');b.textContent='Undo';b.onclick=()=>{if(undo){rows=undo;syncState=undoSync||syncState;undo=null;undoSync=null;persist();render();toast('Change undone.');}};$('#toast').append(b);}toastTimer=setTimeout(()=>$('#toast').hidden=true,canUndo?12000:6000);}
function persist(){try{if(loadError){throw Error('Recovery required');}localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,applications:rows,syncState}));$('#save-state').textContent='Saved on this browser';$('#save-state').classList.remove('error-state');saveSnapshot();cloudUI?.changed();return true;}catch{$('#save-state').textContent='Not saved · export a backup';$('#save-state').classList.add('error-state');toast('Browser storage unavailable. Export a backup to keep your changes.');return false;}}
function mutate(fn,message){undo=structuredClone(rows);undoSync=structuredClone(syncState);fn();const saved=persist();render();if(saved)toast(message,true);}
function setView(v){view=v;$('#status-filter').value='';render();}
function visible(){return filteredRows(rows,{view,query:$('#search').value,status:$('#status-filter').value,priority:$('#priority-filter').value,company:$('#company-filter').value,sort:$('#sort').value});}
function statusSelect(r){return `<select class="status-select ${cls(r.status)}" data-status="${esc(r.id)}" aria-label="Status for ${esc(r.company+' '+r.role)}">${options(STATUSES,r.status)}</select>`;}
function check(r){return `<input class="row-check" type="checkbox" data-check="${esc(r.id)}" ${r.hasApplied?'checked':''} aria-label="Application submitted for ${esc(r.company+' '+r.role)}">`;}
function priority(r){return `<span class="priority ${cls(r.priority)}">${r.priority==='Top'?'★ ':r.priority==='High'?'↑ ':''}${esc(r.priority)}</span>`;}
function role(r){return `<button class="role-button" data-edit="${esc(r.id)}">${esc(r.role)}</button>`;}
function link(r){return safeLink(r.link)?`<div><a class="job-link" href="${esc(safeLink(r.link))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(r.linkLabel||'Posting')} for ${esc(r.company+' '+r.role)}">${esc(r.linkLabel||'Posting')} ↗</a>${r.linkNote?`<details class="link-details"><summary>Link details</summary><p>${esc(r.linkNote)}</p></details>`:''}</div>`:'<span class="subtext">No link</span>';}
function date(s){if(!s)return 'Not recorded';return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function render(){
 const focused=document.activeElement;const focusType=focused?.dataset?.status?'status':focused?.dataset?.check?'check':null;const focusId=focusType?focused.dataset[focusType]:null;
 const counts=Object.fromEntries(STATUSES.map(s=>[s,rows.filter(r=>r.status===s).length]));
 $('#navigation').innerHTML=['All applications','To Apply','Interviewing','Needs Follow-up'].map(s=>`<button class="${view===s?'active':''}" data-view="${s}" ${view===s?'aria-current="page"':''}><span>${s}</span><small>${s==='All applications'?rows.length:counts[s]}</small></button>`).join('');
 $('#stats').innerHTML=['Applied','Interviewing','Rejected','To Apply','Needs Follow-up'].map(s=>`<button class="stat" data-view="${s}" aria-label="${counts[s]} ${s}, show roles"><span><i class="dot ${cls(s)}"></i>${s}</span><strong>${counts[s]}</strong></button>`).join('');
 const top=rows.filter(r=>r.status==='To Apply'&&r.priority==='Top').length;$('#focus-title').textContent=top?`${top} top-priority opportunities. One next step.`:'Make room for your next opportunity.';$('#focus-copy').textContent=top?'Your strongest matches are ready in the To Apply queue.':`${counts['To Apply']} roles in your queue. Keep your next move in sight.`;
 const company=$('#company-filter').value;$('#company-filter').innerHTML='<option value="">All companies</option>'+options([...new Set(rows.map(r=>r.company))].sort(),company);
 const list=visible();$('#view-title').textContent=view;$('#result-count').textContent=`${list.length} ${list.length===1?'role':'roles'}`;
 $('#table-view').setAttribute('aria-pressed',String(format==='table'));$('#card-view').setAttribute('aria-pressed',String(format==='cards'));
 if(!list.length){$('#list').innerHTML='<div class="empty"><h3>No roles in this view.</h3><p>Clear your filters or add a new opportunity.</p></div>';if(focusId)$('#search').focus();return;}
 if(format==='cards'||matchMedia('(max-width:760px)').matches){$('#list').innerHTML='<div class="cards">'+list.map(r=>`<article class="role-card ${r.priority==='Top'?'top-row':''}"><div class="card-top">${check(r)}<span class="company">${esc(r.company)}</span>${priority(r)}</div>${role(r)}<div class="subtext">${esc(r.location||'Location not recorded')}</div><div class="card-details"><div><small>Status</small>${statusSelect(r)}</div><div><small>Applied</small><span>${esc(date(r.appliedDate))}</span></div><div><small>Requisition ID</small><span>${esc(r.requisitionId||'Not recorded')}</span></div><div><small>Follow-up</small><span>${esc(date(r.followUpDate))}</span></div></div><p class="card-notes">${esc(r.notes)}</p><div class="card-bottom">${link(r)}<button class="edit-button" data-edit="${esc(r.id)}">Edit details</button></div></article>`).join('')+'</div>';}else{$('#list').innerHTML='<table class="table"><thead><tr><th><span title="Application submitted">✓</span></th><th>Company</th><th>Role / location</th><th>Status</th><th>Priority</th><th>Applied date</th><th>Link</th><th>Details</th></tr></thead><tbody>'+list.map(r=>`<tr class="${r.priority==='Top'?'top-row':''}"><td>${check(r)}</td><td class="company">${esc(r.company)}</td><td>${role(r)}<div class="subtext">${esc(r.location||'Location not recorded')}${r.requisitionId?' · #'+esc(r.requisitionId):''}</div></td><td>${statusSelect(r)}</td><td>${priority(r)}</td><td class="date">${esc(date(r.appliedDate))}${r.followUpDate?'<div class="subtext">Follow up '+esc(date(r.followUpDate))+'</div>':''}</td><td>${link(r)}</td><td><button class="edit-button" data-edit="${esc(r.id)}">Edit</button></td></tr>`).join('')+'</tbody></table>';}
 if(focusId){const replacement=[...document.querySelectorAll('[data-'+focusType+']')].find(el=>el.dataset[focusType]===focusId);(replacement||$('#search')).focus({preventScroll:true});}
}
function openEditor(id){form.reset();$('#form-error').textContent='';const r=rows.find(r=>r.id===id);$('#editor-title').textContent=r?'Edit application':'Add a role';$('#delete-role').hidden=!r;for(const k of ['id','company','role','location','appliedDate','requisitionId','link','notes','followUpDate'])form.elements[k].value=r?.[k]||'';form.elements.status.value=r?.status||'To Apply';form.elements.priority.value=r?.priority||'Normal';form.elements.hasApplied.checked=r?.hasApplied||false;$('#evidence').innerHTML=r?`${esc(r.evidence||'Manual entry')} · ${esc(r.source||'Added by you')}${r.appliedDateSource?'<br>'+esc(r.appliedDateSource):''}${r.mailEvidence?.messageId?'<br><a target="_blank" rel="noopener noreferrer" href="https://mail.google.com/mail/#all/'+esc(r.mailEvidence.messageId)+'">Read source email ↗</a>':''}`:'';$('#editor').showModal();}
$('#add').onclick=()=>openEditor();$('#close-editor').onclick=$('#cancel-editor').onclick=()=>$('#editor').close();
form.elements.status.onchange=()=>{const s=form.elements.status.value;if(s!=='Needs Follow-up')form.elements.hasApplied.checked=s!=='To Apply';};
form.elements.hasApplied.onchange=()=>{if(form.elements.hasApplied.checked&&form.elements.status.value==='To Apply')form.elements.status.value='Applied';else if(!form.elements.hasApplied.checked&&form.elements.status.value!=='Needs Follow-up')form.elements.status.value='To Apply';};
form.onsubmit=e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(form));if(!fields.company.trim()||!fields.role.trim()){$('#form-error').textContent='Enter a company and role.';return;}if(fields.link&&!safeLink(fields.link)){$('#form-error').textContent='Use an http or https application link.';return;}const old=rows.find(r=>r.id===fields.id);let r={...(old||{id:crypto.randomUUID(),history:[],source:'Manual entry',evidence:'Entered by Kyle'}),...fields,id:old?.id||crypto.randomUUID(),hasApplied:form.elements.hasApplied.checked,company:fields.company.trim(),role:fields.role.trim(),updatedAt:new Date().toISOString()};if(!old||safeLink(old.link)!==safeLink(r.link)){r.linkLabel='';r.linkNote='';}if(old&&old.status!==r.status)r={...r,history:changeStatus(old,r.status).history};if(r.status==='To Apply'){r.hasApplied=false;r.appliedDate='';}else if(r.status!=='Needs Follow-up')r.hasApplied=true;try{r=validateRows([r])[0];}catch(err){$('#form-error').textContent=err.message;return;}mutate(()=>{const i=rows.findIndex(x=>x.id===r.id);if(i<0)rows.push(r);else rows[i]=r;},'Role saved.');$('#editor').close();};
$('#delete-role').onclick=()=>{const id=form.elements.id.value;mutate(()=>{const r=rows.find(r=>r.id===id);syncState.deleted.push(id,r.company.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+r.role.toLowerCase().replace(/[^a-z0-9]/g,''));rows=rows.filter(r=>r.id!==id);},'Role deleted.');$('#editor').close();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-view],[data-edit]');if(b?.dataset.view)setView(b.dataset.view);if(b?.dataset.edit)openEditor(b.dataset.edit);});
$('#list').addEventListener('change',e=>{const id=e.target.dataset.status||e.target.dataset.check;if(!id)return;const status=e.target.dataset.status?e.target.value:e.target.checked?'Applied':'To Apply';mutate(()=>rows=rows.map(r=>r.id===id?changeStatus(r,status):r),'Application updated.');});
$('#search').oninput=render;for(const s of ['company-filter','status-filter','priority-filter','sort'])$('#'+s).onchange=render;
$('#table-view').onclick=()=>{format='table';render();};$('#card-view').onclick=()=>{format='cards';render();};matchMedia('(max-width:760px)').addEventListener('change',render);
$('#focus-button').onclick=()=>{for(const id of ['search','company-filter','status-filter','priority-filter'])$('#'+id).value='';setView('To Apply');};$('#clear-filters').onclick=()=>{for(const s of ['search','company-filter','status-filter','priority-filter'])$('#'+s).value='';setView('All applications');};
function download(data,name){const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>{download(JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),applications:rows,syncState},null,2),'kyle-internships-backup.json');if(loadError){try{const raw=localStorage.getItem(KEY);if(raw)download(raw,'kyle-internships-recovery.json');}catch{}}};
$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const data=JSON.parse(await file.text());if(data.schemaVersion!==1)throw Error('This backup version is not supported.');const imported=validateRows(data.applications);if(!confirm(`Replace your current ${rows.length} roles with ${imported.length} imported roles? Export a backup first if needed.`))return;loadError='';mutate(()=>{rows=imported;syncState=normalizeSyncState(data.syncState);},'Backup imported.');}catch(err){toast('Import failed: '+err.message);}finally{e.target.value='';}};
render();if(loadError){$('#save-state').textContent='Recovery needed · export backup';$('#save-state').classList.add('error-state');toast(loadError);}else persist();

function saveSnapshot(){
 if(hosted)return;
 const body=JSON.stringify({schemaVersion:1,applications:rows,syncState});
 snapshotQueue=snapshotQueue.catch(()=>{}).then(async()=>{const response=await fetch('/api/snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body});if(!response.ok)throw Error('Snapshot failed');}).catch(()=>{$('#sync-status').textContent='Browser saved · job-watch copy unavailable';});
}
async function pullUpdates(){
 if(hosted)return;
 if(syncBusy||loadError||$('#editor').open)return;
 syncBusy=true;$('#refresh-sync').disabled=true;
 try{
  const response=await fetch('/api/sync',{cache:'no-store'});if(!response.ok)throw Error('Sync unavailable');
  const feed=await response.json();if(!feed.lastCheckedAt){$('#sync-status').textContent='Waiting for the first Gmail check';return;}
  const merged=mergeFeed(rows,syncState,feed);const unseen=merged.state.seen.length-syncState.seen.length;
  rows=merged.rows;syncState=merged.state;
  if(unseen){undo=null;undoSync=null;persist();render();if(merged.changes.length)toast(`${merged.changes.length} application updates from your job watch.`);}
  else {localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,applications:rows,syncState}));}
  $('#sync-status').textContent='Gmail checked '+new Date(feed.lastCheckedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const review=syncState.review.map(r=>`${r.company} — ${r.role}: ${r.reason}`);
  const alerts=(Array.isArray(feed.alerts)?feed.alerts:[]).filter(a=>typeof a==='string');
  $('#sync-details').innerHTML='<p>Automatic checks run every six hours while Codex and this computer are running. This page picks up saved updates every minute. Refresh updates reads the latest saved check; it does not start a new Gmail scan.</p>'+((alerts.length||review.length)?'<ul>'+[...alerts,...review].map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':'<p>No uncertain matches waiting for review.</p>');
 }catch{$('#sync-status').textContent='Updates unavailable · your saved roles are safe';}
 finally{syncBusy=false;$('#refresh-sync').disabled=false;}
}
async function pullPublicUpdates(){
 if(cloudUI?.active)return;
 if(syncBusy||loadError||$('#editor').open)return;
 syncBusy=true;$('#refresh-sync').disabled=true;
 try{
  const response=await fetch('./public-data.json',{cache:'no-store'});
  if(!response.ok)throw Error('Checklist unavailable');
  const payload=await response.json();
  const result=mergePublic(rows,syncState.public||{},payload,syncState.deleted);
  const changed=JSON.stringify(rows)!==JSON.stringify(result.rows);
  rows=result.rows;syncState.public=result.baseline;persist();if(changed)render();
  $('#sync-status').textContent='Shared checklist · '+payload.applications.length+' published roles';
  $('#sync-details').innerHTML='<p>Chat publishes company names, roles, statuses and public job links when you request an update. Gmail updates are paused. Posting copies, possible matches and careers-page fallbacks are labeled separately. This page checks every minute. Sign in above to sync your private edits between browsers. Browser edits are not published to GitHub. The cloud copy becomes your source of truth while signed in.</p>';
 }catch{$('#sync-status').textContent='Shared updates unavailable · saved roles are safe';}
 finally{syncBusy=false;$('#refresh-sync').disabled=false;}
}
const refresh=hosted?pullPublicUpdates:pullUpdates;
$('#refresh-sync').onclick=refresh;
$('#editor').addEventListener('close',refresh);
setInterval(refresh,60000);
await refresh();
cloudUI=startCloudSync({
 getLocal:()=>structuredClone({schemaVersion:1,applications:rows,syncState}),
 applyLocal:doc=>{const next=validateRows(doc.applications);rows=next;syncState=normalizeSyncState(doc.syncState);undo=null;undoSync=null;if(!persist())throw Error('Browser storage unavailable');render();},
 canApply:()=>!loadError&&!$('#editor').open,
 download
});
