import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chooseData,linuxUnit,installLinux} from '../linux-install.js';
const release=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'sillage-linux-'));
test('data discovery refuses empty/ambiguous installation and never replaces an existing budget',()=>{
 const home=temp(),root=path.join(home,'stable');
 try{
  assert.throws(()=>chooseData({home,root}),/Aucun budget/);
  assert.equal(chooseData({home,root,newBudget:true}),null);
  const old=path.join(home,'Applications','Budget-15.0.0','data');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'budget.sqlite'),'old');
  assert.equal(chooseData({home,root}),old);
  fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data','budget.sqlite'),'live');
  assert.throws(()=>chooseData({home,root,importData:old}),/existe déjà/);
  assert.equal(fs.readFileSync(path.join(root,'data','budget.sqlite'),'utf8'),'live');
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('service paths quote spaces, percent specifiers and shell-looking dollars',()=>{
 const unit=linuxUnit('/usr/bin/node','/tmp/a b/%name/$cash');
 assert.ok(unit.includes('%%name/$$cash'));assert.ok(unit.includes('WorkingDirectory="/tmp/a b/'));assert.ok(!unit.includes('sh -c'));
});
test('fresh Linux install writes a user service and app launcher outside the release',async()=>{
 const home=temp(),calls=[];
 try{
  const result=await installLinux({home,release,newBudget:true,command:(args)=>{calls.push(args);return args[0]!=='is-active';},probe:async()=>false,ready:async()=>true});
  assert.ok(fs.existsSync(path.join(result.root,'app','simple-workspace.js')));
  assert.ok(fs.existsSync(path.join(result.root,'data')));
  assert.ok(fs.readFileSync(path.join(home,'.config','systemd','user','sillage.service'),'utf8').includes('app/server.js'));
  assert.ok(fs.readFileSync(path.join(home,'.local','share','applications','sillage.desktop'),'utf8').includes('linux-open.js'));
  assert.ok(calls.some(a=>a[0]==='enable'));
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('update preserves SQLite, private links and creates a data backup',async()=>{
 const home=temp();const opts={home,release,command:args=>args[0]!=='is-active',probe:async()=>false,ready:async()=>true};
 try{
  const result=await installLinux({...opts,newBudget:true}),data=path.join(result.root,'data');fs.writeFileSync(path.join(data,'budget.sqlite'),'ledger');fs.writeFileSync(path.join(data,'shared-view.json'),'private-token');
  await installLinux(opts);
  assert.equal(fs.readFileSync(path.join(data,'budget.sqlite'),'utf8'),'ledger');assert.equal(fs.readFileSync(path.join(data,'shared-view.json'),'utf8'),'private-token');
  assert.ok(fs.existsSync(path.join(result.root,'app.previous','package.json')));
  assert.equal(fs.readdirSync(path.join(result.root,'backups')).length,1);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('startup failure restores previous code and service without deleting finances',async()=>{
 const home=temp();const opts={home,release,command:args=>args[0]!=='is-active',probe:async()=>false,ready:async()=>true};
 try{
  const result=await installLinux({...opts,newBudget:true});fs.writeFileSync(path.join(result.root,'app','sentinel.txt'),'previous');fs.writeFileSync(path.join(result.root,'data','budget.sqlite'),'ledger');
  await assert.rejects(installLinux({...opts,ready:async()=>false}),/ne répond pas/);
  assert.equal(fs.readFileSync(path.join(result.root,'app','sentinel.txt'),'utf8'),'previous');assert.equal(fs.readFileSync(path.join(result.root,'data','budget.sqlite'),'utf8'),'ledger');
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('failed migration restores the legacy service and keeps the original budget authoritative',async()=>{
 const home=temp(),calls=[],oldData=path.join(home,'Applications','Budget-15.0.0','data'),unit=path.join(home,'.config/systemd/user/sillage.service');
 try{
  fs.mkdirSync(oldData,{recursive:true});fs.writeFileSync(path.join(oldData,'budget.sqlite'),'original');fs.mkdirSync(path.dirname(unit),{recursive:true});fs.writeFileSync(unit,'legacy service');
  await assert.rejects(installLinux({home,release,command:args=>{calls.push(args);return true;},probe:async()=>false,ready:async()=>false}),/ne répond pas/);
  assert.equal(fs.readFileSync(unit,'utf8'),'legacy service');assert.equal(fs.readFileSync(path.join(oldData,'budget.sqlite'),'utf8'),'original');
  const root=path.join(home,'.local/share/sillage');assert.equal(fs.existsSync(path.join(root,'data')),false);assert.ok(fs.readdirSync(path.join(root,'backups')).some(n=>n.startsWith('failed-import-')));assert.equal(calls.at(-1)[0],'start');
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
