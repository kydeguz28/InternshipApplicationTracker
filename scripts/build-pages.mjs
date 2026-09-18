import './build-static.mjs';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('docs/',root),{recursive:true});
for(const name of ['cloud-sync.js','index.html','styles.css','app.js','data.js','sync.js','public-sync.js','public-data.json'])await copyFile(new URL('dist/'+name,root),new URL('docs/'+name,root));
await writeFile(new URL('docs/.nojekyll',root),'');
