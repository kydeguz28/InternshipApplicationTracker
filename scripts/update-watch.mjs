import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SEED,validateRows} from '../data.js';
import {validateFeed,mergeFeed,emptySyncState} from '../sync.js';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=path.join(root,'.runtime');
await mkdir(dir,{recursive:true});
async function read(name,fallback){try{return JSON.parse((await readFile(path.join(dir,name),'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function write(name,value){const file=path.join(dir,name),temp=file+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(value,null,2));await rename(temp,file);}
if(!process.argv[2])throw Error('Usage: node scripts/update-watch.mjs path/to/batch.json');
const batch=validateFeed(JSON.parse((await readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,'')));
const old=await read('gmail-feed.json',{schemaVersion:1,lastCheckedAt:batch.lastCheckedAt,events:[]});
const events=new Map(old.events.map(e=>[e.id,e]));for(const e of batch.events){if(events.has(e.id)&&JSON.stringify(events.get(e.id))!==JSON.stringify(e))throw Error('Existing event IDs are immutable; use a new correction event ID.');events.set(e.id,e);}
const feed=validateFeed({schemaVersion:1,lastCheckedAt:batch.lastCheckedAt,events:[...events.values()],scan:batch.scan||{},alerts:batch.alerts||[]});
const snapshot=await read('browser-snapshot.json',null);
const merged=mergeFeed(snapshot?validateRows(snapshot.applications):SEED,snapshot?.syncState||emptySyncState(),feed);
await write('gmail-feed.json',feed);
await write('watch-summary.json',{lastCheckedAt:feed.lastCheckedAt,total:merged.rows.length,counts:Object.fromEntries(['Applied','Interviewing','Rejected','To Apply','Needs Follow-up'].map(s=>[s,merged.rows.filter(r=>r.status===s).length])),changes:merged.changes,review:merged.state.review,alerts:feed.alerts});
console.log(JSON.stringify({events:feed.events.length,newEvents:feed.events.length-old.events.length,changes:merged.changes,review:merged.state.review.length},null,2));
