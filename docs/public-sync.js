import {validateRows} from './data.js';
const key=r=>r.company.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+r.role.toLowerCase().replace(/[^a-z0-9]/g,'');
export function mergePublic(input,baseline={},payload,deleted=[]){
 if(payload?.schemaVersion!==1)throw Error('Invalid public checklist');
 const published=validateRows(payload.applications.map(r=>({...r,priority:'Normal',hasApplied:r.status!=='To Apply'})));
 const rows=structuredClone(input),next={...baseline};
 for(const item of published){
  if(deleted.includes(item.id)||deleted.includes(key(item)))continue;
  let row=rows.find(r=>r.id===item.id)||rows.find(r=>key(r)===key(item));
  const previous=baseline[item.id];
  if(!row){row={...item,source:'Published job watch'};rows.push(row);}
  else if(previous && row.status===previous.status){row.status=item.status;row.hasApplied=item.hasApplied;}
  next[item.id]={status:item.status};
 }
 return {rows,baseline:next};
}
