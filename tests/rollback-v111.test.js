import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {preserveRollbackRelease,verifyRollbackRelease} from '../mac-rollback.js';
import {releaseFiles} from '../rollback-v111-manifest.js';

test('the pinned 11.1 code is saved independently, verified, reusable and protected against tampering',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillage rollback '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const installed=path.join(root,'installed'),data=path.join(installed,'data');fs.mkdirSync(data,{recursive:true});fs.writeFileSync(path.join(data,'keep.txt'),'never replace data');
  const archive=path.join(root,'reference.tar');execFileSync('git',['archive','-o',archive,'bb25864082819775d6ce65d860cbe30806c01e54']);execFileSync('tar',['-xf',archive,'-C',installed]);
  const before=fs.readFileSync(path.join(installed,'server.js'),'utf8');
  const saved=preserveRollbackRelease(installed,data);assert.equal(verifyRollbackRelease(saved),saved);assert.ok(Object.keys(releaseFiles).length>50);assert.equal(fs.existsSync(path.join(saved,'data')),false);
  fs.writeFileSync(path.join(installed,'server.js'),'new application code');assert.equal(fs.readFileSync(path.join(saved,'server.js'),'utf8'),before);assert.equal(preserveRollbackRelease(installed,data),saved);assert.equal(fs.readFileSync(path.join(data,'keep.txt'),'utf8'),'never replace data');
  fs.appendFileSync(path.join(saved,'server.js'),'modified');assert.throws(()=>verifyRollbackRelease(saved),/incomplète ou modifiée/);assert.throws(()=>preserveRollbackRelease(installed,data),/incomplète ou modifiée/);
});
test('modified 11.1 code cannot be recorded as an authentic fallback and no newer code is mistaken for 11.1',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillage fallback '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'11.1.0'}));assert.throws(()=>preserveRollbackRelease(root,path.join(root,'data')),/incomplète ou modifiée/);assert.equal(fs.existsSync(path.join(root,'data','backups','sillage-v11.1.0-release')),false);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'11.2.0'}));assert.equal(preserveRollbackRelease(root,path.join(root,'data')),null);
});
