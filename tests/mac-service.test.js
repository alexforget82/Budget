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
