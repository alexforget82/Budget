import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadPrivateAccess,authorizePrivateRequest} from '../private-access.js';
const config={origin:'https://budget.exemple.ts.net',login:'alex@example.test',port:3031,host:'budget.exemple.ts.net'};
const request=(headers={},method='GET')=>({headers:{host:config.host,...headers},method});
function fileTest(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'budget-private-'));try{fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('private access is disabled by default',()=>fileTest(dir=>assert.equal(loadPrivateAccess(dir,3030),null)));
test('valid private configuration uses only a dedicated port and a Tailscale HTTPS hostname',()=>fileTest(dir=>{fs.writeFileSync(path.join(dir,'private-access.json'),JSON.stringify({...config,login:'Alex@Example.test'}));assert.deepEqual(loadPrivateAccess(dir,3030),config)}));
test('invalid private configuration fails closed',()=>fileTest(dir=>{for(const bad of [{origin:'http://budget.exemple.ts.net'},{origin:'https://public.example.com'},{origin:'https://budget.exemple.ts.net/path'},{origin:'https://a:b@budget.exemple.ts.net'},{origin:'https://budget.exemple.ts.net:8443'},{login:''},{login:'alex\nother'},{port:3030},{port:0}]){fs.writeFileSync(path.join(dir,'private-access.json'),JSON.stringify({...config,...bad}));assert.throws(()=>loadPrivateAccess(dir,3030));}}));
test('owner identity is required even when the proxy rewrites the host to loopback',()=>{
 for(const host of [config.host,'127.0.0.1:3031','localhost:3031']){assert.equal(authorizePrivateRequest(request({host,'tailscale-user-login':config.login}),config),null);assert.ok(authorizePrivateRequest(request({host}),config));}
 assert.equal(authorizePrivateRequest(request({'tailscale-user-login':'Alex%40Example.test'}),config),null);
});
test('other identities, forwarded impersonation and foreign hosts cannot read private data',()=>{
 for(const headers of [{'tailscale-user-login':'other@example.test'},{'x-forwarded-user':config.login},{'tailscale-user-login':config.login,host:'public.example.com'},{'tailscale-user-login':'%invalid'}])assert.ok(authorizePrivateRequest(request(headers),config));
});
test('remote writes require the exact HTTPS origin, owner and JSON body',()=>{
 const valid={'tailscale-user-login':config.login,origin:config.origin,'content-type':'application/json'};assert.equal(authorizePrivateRequest(request(valid,'POST'),config),null);
 for(const bad of [{origin:undefined},{origin:'https://evil.example.com'},{origin:'http://budget.exemple.ts.net'},{'content-type':'text/plain'},{'tailscale-user-login':undefined}])assert.ok(authorizePrivateRequest(request({...valid,...bad},'POST'),config));
});
