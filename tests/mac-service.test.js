import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {servicePlist} from '../mac-service.js';

test('launch agent property list round-trips paths with spaces and XML special characters',()=>{
 const root='/Users/Alex & Jenny/Library/Application Support/Mon Budget',node='/opt/Node "LTS"/node',logs='/Users/Alex & Jenny/Library/Logs/Mon Budget';
 const r=spawnSync('python3',['-c','import sys,plistlib,json;print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'],{input:servicePlist(node,root,logs),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout);assert.deepEqual(p.ProgramArguments,[node,root+'/mac-service.js','run']);assert.equal(p.WorkingDirectory,root);assert.equal(p.StandardErrorPath,logs+'/budget-error.log');assert.equal(p.RunAtLoad,true);assert.equal(p.KeepAlive,true);assert.equal(p.ThrottleInterval,15);assert.equal(p.ExitTimeOut,20);
});
test('macOS installer refuses unsupported platforms without trying to install a service',()=>{
 if(process.platform==='darwin')return;
 const r=spawnSync(process.execPath,['mac-service.js','install'],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/nécessite macOS/);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {shortcutScript} from '../mac-service.js';
import {validateUpdateFolder} from '../mac-update.js';
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"budget Alex's & Jenny "));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function release(dir,version='4.0.1'){fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'mon-budget-local',version}));for(const name of ['budget-journey.js','demo-workspace.js','budget-v70.js','budget-v70.css','budget-schedule.js','monthly-budget.js','budget-v60.js','budget-v60.css','mac-service.js','mac-update.js','server.js','index.html','planning-v4.js','planning-v4.css','budget-support.js','budget-v41.js','budget-v41.css','free-budgets.js','free-budgets-ui.js','free-budgets.css','envelope-tools.js','envelope-v44.js','envelope-v44.css','category-tools.js','categories-v46.js','categories-v46.css','dashboard-layout.js','dashboard-v47.js','dashboard-v47.css','budget-life.js','budget-v50.js','budget-v50.css','Acces prive iPhone.command'])fs.writeFileSync(path.join(dir,name),'');}
test('permanent shortcut passes paths and arguments literally through bash',t=>{
 const dir=fixture(t),script=path.join(dir,"open ' budget.js"),shortcut=path.join(dir,'Ouvrir.command');fs.writeFileSync(script,'console.log(JSON.stringify(process.argv.slice(2)))');fs.writeFileSync(shortcut,shortcutScript(process.execPath,script,"open ' $BUDGET_RESULT ; &"));const r=spawnSync('/bin/bash',[shortcut],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),["open ' $BUDGET_RESULT ; &"]);
});
test('update folder accepts complete same/newer releases without writing to them',t=>{
 const dir=fixture(t);release(dir);const before=fs.readdirSync(dir);assert.equal(validateUpdateFolder(dir,'4.0.1'),dir);assert.equal(validateUpdateFolder(dir,'3.9.9'),dir);assert.deepEqual(fs.readdirSync(dir),before);
});
test('update folder refuses downgrades and unrelated applications',t=>{
 const dir=fixture(t);release(dir,'4.0.0');assert.throws(()=>validateUpdateFolder(dir,'4.0.1'),/ancienne/);fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'other-app',version:'9.0.0'}));assert.throws(()=>validateUpdateFolder(dir,'4.0.1'),/Mon Budget/);
});
test('incomplete release is rejected before its installer can execute',t=>{
 const dir=fixture(t);release(dir);fs.unlinkSync(path.join(dir,'server.js'));assert.throws(()=>validateUpdateFolder(dir,'4.0.1'));
});

import {openAfterInstall} from '../mac-service.js';
test('an existing installation never opens Safari or Finder, including calls from an older updater',()=>{
 const opened=[];openAfterInstall({firstInstall:false,quiet:false,shortcuts:'/Applications/Mon Budget',origin:'https://budget.ts.net'},target=>opened.push(target));assert.deepEqual(opened,[]);
});
test('a quiet update opens nothing, while a first installation keeps its opening shortcuts',()=>{
 const opened=[],options={firstInstall:true,quiet:true,shortcuts:'/Applications/Mon Budget',origin:'https://budget.ts.net'};openAfterInstall(options,target=>opened.push(target));assert.deepEqual(opened,[]);openAfterInstall({...options,quiet:false},target=>opened.push(target));assert.deepEqual(opened,[options.shortcuts,options.origin]);
});
