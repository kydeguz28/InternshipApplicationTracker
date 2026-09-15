import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('Vercel build publishes only browser assets without local functions or private data',async()=>{
 execFileSync(process.execPath,['scripts/build-static.mjs'],{cwd:root});
 const dir=new URL('../dist/',import.meta.url);
 assert.deepEqual((await readdir(dir)).sort(),['app.js','data.js','index.html','public-data.json','public-sync.js','styles.css','sync.js']);
 assert.match(await readFile(new URL('index.html',dir),'utf8'),/<body data-hosting="static">/);
 assert.match(await readFile(new URL('data.js',dir),'utf8'),/export const SEED=\[\];/);
 const config=JSON.parse((await readFile(new URL('../vercel.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
 assert.equal(config.framework,null);assert.equal(config.outputDirectory,'dist');
});
