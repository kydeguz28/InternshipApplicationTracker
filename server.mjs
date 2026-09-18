import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateRows} from './data.js';
import {validateFeed,normalizeSyncState} from './sync.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||4173),origin=`http://localhost:${port}`;
const staticFiles=new Set(['index.html','styles.css','app.js','data.js','sync.js','public-sync.js','public-data.json','cloud-sync.js']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
let writeQueue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});res.end(typeof body==='string'?body:JSON.stringify(body));};
 try{
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host))return send(403,{error:'Invalid host'});
  const pathname=new URL(req.url,origin).pathname;
  if(pathname==='/api/sync'&&req.method==='GET'){
   try{return send(200,validateFeed(JSON.parse(await readFile(path.join(root,'.runtime/gmail-feed.json'),'utf8'))));}catch(e){if(e.code==='ENOENT')return send(200,{schemaVersion:1,lastCheckedAt:null,events:[]});throw e;}
  }
  if(pathname==='/api/snapshot'&&req.method==='POST'){
   if(![origin,`http://127.0.0.1:${port}`].includes(req.headers.origin)||req.headers['content-type']!=='application/json')return send(403,{error:'Same-origin JSON required'});
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10*1024*1024)return send(413,{error:'Backup too large'});}
   const input=JSON.parse(raw);if(input.schemaVersion!==1)throw Error('Unsupported snapshot');
   const snapshot={schemaVersion:1,applications:validateRows(input.applications),syncState:normalizeSyncState(input.syncState),savedAt:new Date().toISOString()};
   const op=writeQueue.catch(()=>{}).then(async()=>{await mkdir(path.join(root,'.runtime'),{recursive:true});const file=path.join(root,'.runtime/browser-snapshot.json');await writeFile(file+'.tmp',JSON.stringify(snapshot));await rename(file+'.tmp',file);});writeQueue=op;await op;return send(200,{saved:true});
  }
  const file=pathname==='/'?'index.html':pathname.slice(1);if(req.method!=='GET'||!staticFiles.has(file))return send(404,{error:'Not found'});
  return send(200,await readFile(path.join(root,file==='cloud-sync.js'?'dist/cloud-sync.js':file),'utf8'),types[path.extname(file)]);
 }catch{return send(500,{error:'Unable to read or save local data. Your browser copy is unchanged.'});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Internship Desk is running at ${origin}`);if(process.argv.includes('--open')&&process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',origin],{windowsHide:true,stdio:'ignore'});});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is already in use. Open ${origin} if the tracker is already running.`:e.message);process.exitCode=1;});
