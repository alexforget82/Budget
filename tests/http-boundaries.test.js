import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readJson,isJsonRequest} from '../http-body.js';
import {authorizeRequest} from '../http-security.js';
import {assetName} from '../http-assets.js';

test('JSON reader counts bytes including split UTF-8 sequences and the exact boundary',async()=>{
 const body=Buffer.from(JSON.stringify({description:'Épicerie 🥕'}));
 assert.deepEqual(await readJson(Readable.from([body.subarray(0,17),body.subarray(17)]),body.length),{description:'Épicerie 🥕'});
 await assert.rejects(()=>readJson(Readable.from([body]),body.length-1),e=>e.httpStatus===413);
});
test('invalid JSON and non-object bodies fail before domain mutations',async()=>{
 for(const body of ['null','[]','true','12','"text"','{'])await assert.rejects(()=>readJson(Readable.from([Buffer.from(body)]),100),e=>e.httpStatus===400);
});
test('JSON MIME type is exact and permits normal parameters, not lookalike types',()=>{
 for(const type of ['application/json','application/json; charset=utf-8','Application/JSON'])assert.equal(isJsonRequest({headers:{'content-type':type}}),true);
 for(const type of ['text/plain','application/jsonx','application/json-patch+json',''])assert.equal(isJsonRequest({headers:{'content-type':type}}),false);
});
test('private listener never falls back to local privilege and ignores forwarded identity',()=>{
 const config={host:'budget.test.ts.net',origin:'https://budget.test.ts.net',port:3031,login:'owner@example.test'};
 const req={method:'GET',socket:{localPort:3031},headers:{host:config.host,'x-forwarded-user':'owner@example.test'}};
 assert.match(authorizeRequest(req,{privateAccess:config,localPort:3030,viewing:false}),/Tailscale/);
 req.headers['tailscale-user-login']='other@example.test';assert.match(authorizeRequest(req,{privateAccess:config,localPort:3030,viewing:false}),/propriétaire/);
 req.headers['tailscale-user-login']='owner@example.test';assert.equal(authorizeRequest(req,{privateAccess:config,localPort:3030,viewing:false}),null);
 req.headers.host='attacker.test';assert.match(authorizeRequest(req,{privateAccess:config,localPort:3030,viewing:true}),/Hôte/);
});
test('assets remain an explicit allowlist with version strings, never arbitrary server files',()=>{
 assert.equal(assetName('/ui-entry.js?v=11.4.0'),'ui-entry.js');
 for(const url of ['/server.js','/data/budget.sqlite','/../server.js','/app.js?anything=1','/app.js?v=../data','/private-access.js'])assert.equal(assetName(url),null,url);
});
