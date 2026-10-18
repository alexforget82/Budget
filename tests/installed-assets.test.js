import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {copyReleaseFiles} from '../mac-service.js';
import {validateUpdateFolder} from '../mac-update.js';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('installed release serves every page asset and survives a missing logo without touching user files',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillage installed '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data','keep.txt'),'existing user data');
 copyReleaseFiles(source,root);assert.equal(fs.readFileSync(path.join(root,'data','keep.txt'),'utf8'),'existing user data');assert.equal(fs.existsSync(path.join(root,'tests')),false);assert.equal(fs.existsSync(path.join(root,'docs')),false);
 validateUpdateFolder(root,'9.0.0');
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',x=>log+=x);child.stdout.on('data',()=>{});t.after(async()=>{if(child.exitCode===null){const closed=once(child,'exit');child.kill();await closed;}});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/state');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,30));}assert.ok(ready,log);
 const html=await(await fetch(base+'/')).text();const assets=[...html.matchAll(/(?:src|href)="(\/[A-Za-z0-9][A-Za-z0-9._-]*)"/g)].map(m=>m[1]);assert.ok(assets.includes('/sillage-logo.svg'));assert.ok(assets.includes('/sillage-icon.png'));assert.ok(assets.includes('/sillage.webmanifest'));
 for(const url of assets){const r=await fetch(base+url);assert.equal(r.status,200,url);const type=url.endsWith('.css')?'text/css':url.endsWith('.js')?'text/javascript':url.endsWith('.svg')?'image/svg+xml':url.endsWith('.png')?'image/png':'application/manifest+json';assert.ok(r.headers.get('content-type').startsWith(type),url);assert.ok((await r.arrayBuffer()).byteLength>0,url);}
 const before=await(await fetch(base+'/api/state')).json();fs.unlinkSync(path.join(root,'sillage-logo.svg'));const missing=await fetch(base+'/sillage-logo.svg');assert.equal(missing.status,404);assert.match((await missing.json()).error,/manquant/);const after=await(await fetch(base+'/api/state')).json();assert.deepEqual(after.accounts,before.accounts);assert.equal(after.safe_cents,before.safe_cents);assert.equal(child.exitCode,null);assert.ok(!log.includes('ERR_HTTP_HEADERS_SENT'));assert.equal(fs.readFileSync(path.join(root,'data','keep.txt'),'utf8'),'existing user data');assert.throws(()=>validateUpdateFolder(root,'9.0.0'));
});
test('release copier includes icons and manifest and excludes unrelated files and data folders',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillage copy '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const from=path.join(root,'from'),to=path.join(root,'installed');fs.mkdirSync(from);fs.mkdirSync(to);for(const name of ['app.css','app.js','index.html','logo.svg','icon.png','site.webmanifest','package.json','Acces prive iPhone.command'])fs.writeFileSync(path.join(from,name),'asset:'+name);fs.mkdirSync(path.join(from,'data'));fs.writeFileSync(path.join(from,'data','budget.sqlite'),'do not copy');fs.writeFileSync(path.join(from,'private.txt'),'do not copy');fs.mkdirSync(path.join(to,'data'));fs.writeFileSync(path.join(to,'data','budget.sqlite'),'keep active database');copyReleaseFiles(from,to);for(const name of fs.readdirSync(from).filter(n=>n!=='data'&&n!=='private.txt'))assert.equal(fs.readFileSync(path.join(to,name),'utf8'),'asset:'+name);assert.equal(fs.readFileSync(path.join(to,'data','budget.sqlite'),'utf8'),'keep active database');assert.ok(!fs.existsSync(path.join(to,'private.txt')));copyReleaseFiles(to,to);
});
