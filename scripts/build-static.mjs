import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const dist=path.resolve(root,'dist');
if(path.dirname(dist)!==path.resolve(root)||path.basename(dist)!=='dist')throw Error('Unexpected output directory');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const files=['index.html','styles.css','app.js','data.js','sync.js'];
for(const name of files){let content=await readFile(path.join(root,name),'utf8');if(name==='index.html')content=content.replace('<body>','<body data-hosting="static">');await writeFile(path.join(dist,name),content);}
console.log('Built static tracker in dist/ (no server functions or private runtime files).');
