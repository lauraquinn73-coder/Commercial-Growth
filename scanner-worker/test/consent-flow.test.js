import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
import { PRIVACY_VERSION } from '../records.js';

// Local-only test environment; no verification bypass exists on remote Worker URLs.
function sampleDb(){
 const rows=[];
 return {rows,prepare(sql){return {bind(...args){return {async run(){rows.push({sql,args});return {success:true};}};}};}};
}

test('normal scan remains available without saving; saving requires consent and declared authority',async()=>{
 const oldFetch=globalThis.fetch, oldRewriter=globalThis.HTMLRewriter;
 class Rewriter { on(){return this;} transform(res){return res;} }
 globalThis.HTMLRewriter=Rewriter;
 globalThis.fetch=async url=>{
  const address=String(url);
  if(address.includes('dns-query')) return Response.json({Status:0,Answer:address.includes('type=AAAA')?[]:[{type:1,data:'1.1.1.1'}]});
  if(address.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
  return new Response('<title>Sample</title><h1>Public business</h1>',{headers:{'Content-Type':'text/html'}});
 };
 try{
  const db=sampleDb();
  const env={ALLOWED_ORIGINS:'http://localhost:8000',SCAN_DB:db,ENABLE_PRIVATE_CAPTURE:'true'};
  const scan=async props=>{
   const req=new Request('http://127.0.0.1:8787/scan',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify({url:'https://business.ie/',...props})});
   const res=await worker.fetch(req,env);
   assert.equal(res.status,200);
   return res.json();
  };
  const noOptin=await scan({});
  assert.equal(noOptin.scanSaved,false);
  assert.equal(db.rows.length,0);
  const notAuthorised=await scan({saveScan:true,privacyVersion:PRIVACY_VERSION});
  assert.equal(notAuthorised.scanSaved,false);
  assert.equal(db.rows.length,0);
  const optedIn=await scan({saveScan:true,domainAuthority:true,privacyVersion:PRIVACY_VERSION});
  assert.equal(optedIn.scanSaved,true);
  assert.match(optedIn.withdrawalCode,/^[0-9a-f]{64}$/);
  assert.equal(db.rows.length,1);
  assert.ok(!JSON.stringify(db.rows).includes(optedIn.withdrawalCode));
 } finally { globalThis.fetch=oldFetch;globalThis.HTMLRewriter=oldRewriter; }
});
