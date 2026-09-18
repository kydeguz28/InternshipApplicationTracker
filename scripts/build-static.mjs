import {build} from 'esbuild';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const dist=path.resolve(root,'dist');
if(path.dirname(dist)!==path.resolve(root)||path.basename(dist)!=='dist')throw Error('Unexpected output directory');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const files=['index.html','styles.css','app.js','data.js','sync.js','public-sync.js','public-data.json'];
for(const name of files){let content=await readFile(path.join(root,name),'utf8');if(name==='index.html')content=content.replace('<body>','<body data-hosting="static">');await writeFile(path.join(dist,name),content);}
await build({entryPoints:[path.join(root,'cloud/browser.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:path.join(dist,'cloud-sync.js')});
console.log('Built static tracker in dist/ (no server functions or private runtime files).');
