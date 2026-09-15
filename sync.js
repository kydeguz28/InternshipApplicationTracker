import {STATUSES,PRIORITIES,validateRows,safeLink} from './data.js';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const time=s=>Date.parse(s)||0;
export function validateFeed(feed){
 if(feed?.schemaVersion!==1||!Array.isArray(feed.events)||feed.events.length>20000||!time(feed.lastCheckedAt))throw Error('Invalid Gmail update feed.');
 const ids=new Set();const events=feed.events.map(e=>{
  if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9:_-]{1,180}$/.test(e.id)||ids.has(e.id)||!e.company?.trim()||!e.role?.trim()||!STATUSES.includes(e.status)||!time(e.occurredAt)||!e.evidence?.trim())throw Error('Every update needs a unique ID, company, role, status, date and evidence.');
  if(e.kind!=='gmail'&&e.kind!=='search')throw Error('Update kind must be gmail or search.');
  if(e.kind==='gmail'&&!/^[a-f0-9]+$/i.test(e.messageId||''))throw Error('Gmail updates require a message ID.');
  if(e.kind==='search'&&(e.status!=='To Apply'||!safeLink(e.link)))throw Error('Search updates can only add linked To Apply opportunities.');
  ids.add(e.id);for(const k of ['appliedDate','followUpDate'])if(e[k]&&!/^\d{4}-\d{2}-\d{2}$/.test(e[k]))throw Error('Invalid update date.');
  return {...e,link:safeLink(e.link||''),priority:PRIORITIES.includes(e.priority)?e.priority:'Normal'};
 });return {...feed,events};
}
export function emptySyncState(){return {seen:[],deleted:[],review:[],lastCheckedAt:''};}
export function normalizeSyncState(state){return {seen:Array.isArray(state?.seen)?state.seen.filter(x=>typeof x==='string'):[],deleted:Array.isArray(state?.deleted)?state.deleted.filter(x=>typeof x==='string'):[],review:Array.isArray(state?.review)?state.review.filter(x=>x&&typeof x.reason==='string'):[],lastCheckedAt:typeof state?.lastCheckedAt==='string'?state.lastCheckedAt:''};}
export function mergeFeed(input,state,raw){
 const feed=validateFeed(raw),rows=structuredClone(input),next=normalizeSyncState(state),seen=new Set(next.seen),deleted=new Set(next.deleted),changes=[];
 for(const e of [...feed.events].sort((a,b)=>time(a.occurredAt)-time(b.occurredAt))){
  if(seen.has(e.id))continue;
  seen.add(e.id);
  let matches=e.recordId?rows.filter(r=>r.id===e.recordId):rows.filter(r=>norm(r.company)===norm(e.company)&&((e.requisitionId&&r.requisitionId===e.requisitionId)||norm(r.role)===norm(e.role)));
  if(deleted.has(e.recordId)||deleted.has(e.id)||deleted.has(norm(e.company)+'|'+norm(e.role)))continue;
  if(matches.length>1||(matches.length===0&&!e.allowCreate)||(matches.length===1&&norm(matches[0].company)!==norm(e.company))){next.review.push({eventId:e.id,company:e.company,role:e.role,status:e.status,messageId:e.messageId||'',reason:'No unambiguous role match. Review the source before updating.'});continue;}
  let r=matches[0];
  if(!r){r=validateRows([{id:e.recordId||e.id,company:e.company,role:e.role,status:e.status,priority:e.priority,hasApplied:e.hasApplied??e.status!=='To Apply',location:e.location||'',requisitionId:e.requisitionId||'',link:e.link,notes:e.note||'',appliedDate:e.appliedDate||'',followUpDate:e.followUpDate||'',source:e.kind==='gmail'?'Gmail job watch':'Employer search',evidence:e.evidence,history:[]}])[0];rows.push(r);changes.push({id:r.id,type:'added',company:r.company,role:r.role,status:r.status});}
  const lastManual=Math.max(0,...r.history.filter(h=>h.source==='manual').map(h=>time(h.at)));
  const conflict=lastManual>=time(e.occurredAt)&&r.status!==e.status;
  const stale=time(r.lastStatusEventAt)>time(e.occurredAt);
  const downgrade=e.status==='Applied'&&['Interviewing','Rejected','Needs Follow-up'].includes(r.status);
  const searchExisting=e.kind==='search'&&r.hasApplied;
  if(!r.appliedDate&&e.appliedDate&&!conflict){r.appliedDate=e.appliedDate;r.appliedDateSource=e.dateSource||'Gmail confirmation receipt date';}
  for(const k of ['location','requisitionId','link'])if(!r[k]&&e[k])r[k]=e[k];
  if(conflict){next.review.push({eventId:e.id,company:e.company,role:e.role,status:e.status,messageId:e.messageId||'',reason:'Kept your newer manual status. Review this older email if needed.'});}
  if(!conflict&&!stale&&!downgrade&&!searchExisting){
   if(r.status!==e.status){changes.push({id:r.id,type:'status',company:r.company,role:r.role,from:r.status,status:e.status});r.history.push({from:r.status,to:e.status,at:e.occurredAt,source:e.kind,eventId:e.id});r.status=e.status;}
   r.hasApplied=e.hasApplied??(e.status==='Needs Follow-up'?r.hasApplied:e.status!=='To Apply');
   r.lastStatusEventAt=e.occurredAt;
   if(e.followUpDate&&!r.followUpDate)r.followUpDate=e.followUpDate;
  }
  if(!stale&&(!downgrade||!r.mailEvidence)){r.evidence=e.evidence;r.source=e.kind==='gmail'?'Gmail job watch':'Employer search';r.mailEvidence={summary:e.evidence,messageId:e.messageId||'',at:e.occurredAt,eventId:e.id};}
  r.updatedAt=new Date().toISOString();
 }
 next.seen=[...seen];next.lastCheckedAt=feed.lastCheckedAt;return {rows,state:next,changes};
}
