import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
import { PRIVACY_VERSION, validateLeadPayload, recordLead, recordOptInScan, eraseByReceipt, receiptHash, deleteExpired } from '../records.js';
const answers={
  offer:'We sell cleaning services',business_url:'https://smallbusiness.ie/',challenge:['conversion','follow_up'],monthly_enquiries:'11-30',
  conversion_visibility:'no',follow_up:'rarely',repeat_potential:'some',support_interest:'audit_only',timeline:'month',heard_from:'referral'
};
const lead={name:'Client Name',email:'hello@example.ie',business:'Test Business',answers,priorities:['conversion','follow_up'],shareConsent:true,privacyVersion:PRIVACY_VERSION};
function dbStub() {
  const inserts=[];
  return {
    inserts,
    prepare(sql) {
      return {
        bind(...args) {
          return { async run() { inserts.push({sql,args}); return {success:true}; } };
        }
      };
    }
  };
}
test('lead schema accepts valid questionnaire and rejects missing consent, illegal choices',()=>{
  assert.deepEqual(validateLeadPayload(lead).priorities,['conversion','follow_up']);
  assert.throws(()=>validateLeadPayload({...lead,shareConsent:false}),/confirm/);
  assert.throws(()=>validateLeadPayload({...lead,answers:{...answers,monthly_enquiries:'a thousand'}}),/complete/);
  assert.throws(()=>validateLeadPayload({...lead,answers:{...answers,business_url:'http://localhost:3000/'}}),/public HTTPS/);
  assert.throws(()=>validateLeadPayload({...lead,answers:{...answers,challenge:['conversion','conversion']}}),/complete/);
});
test('opt-in scan stores domain and categories only, with a 30-day expiry',async()=>{
  const db=dbStub();
  const receipt=await recordOptInScan(db,{host:'smallbusiness.ie',findings:[{category:'Conversion'}],partial:false},1000);
  assert.match(receipt.code,/^[a-f0-9]{64}$/);
  assert.equal(db.inserts.length,1);
  assert.equal(db.inserts[0].args[0],'smallbusiness.ie');
  assert.equal(db.inserts[0].args[3],'completed');
  assert.equal(db.inserts[0].args[5],1000+30*86400);
  assert.equal(db.inserts[0].args[6],PRIVACY_VERSION);
  assert.equal(db.inserts[0].args[8],'optional_scanner_history');
  assert.equal(db.inserts[0].args[9],await receiptHash(receipt.code));
  assert.ok(!JSON.stringify(db.inserts).includes(receipt.code));
  assert.ok(!JSON.stringify(db.inserts).includes('customer record'));
});
test('lead insert retains only validated answers and schedules 365-day expiry',async()=>{
  const db=dbStub();
  const response=await recordLead(db,lead,1000);
  assert.match(response.code,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(db.inserts).includes(response.code));
  assert.equal(db.inserts.length,1);
  assert.equal(db.inserts[0].args[7],1000+365*86400);
  assert.equal(JSON.parse(db.inserts[0].args[4]).offer,answers.offer);
});
test('expired records are deleted from both tables',async()=>{
  const db=dbStub();await deleteExpired(db,1000);
  assert.equal(db.inserts.length,2);
  assert.ok(db.inserts.every(x=>x.args[0]===1000));
});
test('lead route is disabled without D1 and accepts consent only when bound',async()=>{
  const url='http://127.0.0.1:8787/lead';
  const headers={Origin:'http://localhost:8000','Content-Type':'application/json'};
  const r1=await worker.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify(lead)}),{ALLOWED_ORIGINS:'http://localhost:8000'});
  assert.equal(r1.status,503);
  // Local test path still requires the persistent store.
  const db=dbStub();
  const r2=await worker.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify(lead)}),{ALLOWED_ORIGINS:'http://localhost:8000',SCAN_DB:db,ENABLE_PRIVATE_CAPTURE:'true'});
  assert.equal(r2.status,201);
  assert.equal((await r2.json()).ok,true);
  assert.equal(db.inserts.length,1);
});
test('public capabilities does not expose data and is disabled without binding',async()=>{
  const req=new Request('https://scanner.workers.dev/capabilities',{headers:{Origin:'https://commercialgrowth.ie'}});
  const r=await worker.fetch(req,{ALLOWED_ORIGINS:'https://commercialgrowth.ie'});
  assert.deepEqual(await r.json(),{ok:true,scanHistory:false,leadSharing:false,withdrawal:false,privacyVersion:PRIVACY_VERSION});
});

test('no private record is enabled by binding D1 alone',async()=>{
  const db=dbStub();
  const req=new Request('http://127.0.0.1:8787/lead',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify(lead)});
  const r=await worker.fetch(req,{ALLOWED_ORIGINS:'http://localhost:8000',SCAN_DB:db});
  assert.equal(r.status,503);
  assert.equal(db.inserts.length,0);
});
test('privacy receipt cannot be guessed from the database row, and invalid code is rejected',async()=>{
  const db=dbStub();
  const a=await recordLead(db,lead,1000);
  const b=await recordLead(db,lead,1000);
  assert.notEqual(a.code,b.code);
  assert.notEqual(await receiptHash(a.code),await receiptHash(b.code));
  await assert.rejects(()=>receiptHash('short'),/valid private deletion code/);
});
test('withdrawal route rejects invalid and unavailable requests',async()=>{
  const url='http://127.0.0.1:8787/withdraw';
  const headers={Origin:'http://localhost:8000','Content-Type':'application/json'};
  const db=dbStub();
  const disabled=await worker.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({code:'a'.repeat(64)})}),{ALLOWED_ORIGINS:'http://localhost:8000',SCAN_DB:db});
  assert.equal(disabled.status,503);
  const invalid=await worker.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({code:'bad'})}),{ALLOWED_ORIGINS:'http://localhost:8000',SCAN_DB:db,ENABLE_PRIVATE_CAPTURE:'true'});
  assert.equal(invalid.status,400);
  assert.equal(db.inserts.length,0);
});
test('withdrawal hashes receipt and deletes only by hash, not by visitor PII',async()=>{
  const db=dbStub();
  const code='a'.repeat(64);
  const removed=await eraseByReceipt(db,code);
  assert.equal(removed,false);
  assert.equal(db.inserts.length,2);
  assert.ok(db.inserts.every(x=>x.sql.includes('DELETE FROM')));
  assert.ok(db.inserts.every(x=>x.args[0]!==code));
  assert.ok(db.inserts.every(x=>x.args[0]===db.inserts[0].args[0]));
});

test('receipt withdrawal deletes a matching record and does not disclose presence of a record',async()=>{
  const rows=[];
  const db={
    prepare(sql){
      return {
        bind(...args){
          return {
            async run(){
              if(sql.includes('INSERT INTO scanner_scans')){rows.push({type:'scan',hash:args[9]});return {success:true};}
              if(sql.includes('INSERT INTO growth_leads')){rows.push({type:'lead',hash:args[11]});return {success:true};}
              if(sql.includes('DELETE FROM')){
                let changes=0;
                const type=sql.includes('scanner_scans')?'scan':'lead';
                for(let i=rows.length-1;i>=0;i--){
                  if(rows[i].hash===args[0] && rows[i].type===type){rows.splice(i,1);changes++;}
                }
                return {meta:{changes}};
              }
              throw Error('unexpected SQL');
            }
          };
        }
      };
    }
  };
  const first=await recordOptInScan(db,{host:'business.ie',findings:[],partial:false});
  const second=await recordLead(db,lead);
  assert.equal(rows.length,2);
  assert.equal(await eraseByReceipt(db,'b'.repeat(64)),false);
  assert.equal(rows.length,2);
  assert.equal(await eraseByReceipt(db,first.code),true);
  assert.equal(rows.length,1);
  assert.equal(rows[0].type,'lead');
  assert.equal(await eraseByReceipt(db,second.code),true);
  assert.equal(rows.length,0);
  assert.equal(await eraseByReceipt(db,first.code),false);
});

test('public withdrawal endpoint requires allowed Origin and returns generic success for unknown codes',async()=>{
  const db=dbStub();
  const correctOrigin='http://localhost:8000';
  const req=(origin)=>new Request('http://127.0.0.1:8787/withdraw',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'a'.repeat(64)})});
  const env={ALLOWED_ORIGINS:correctOrigin,SCAN_DB:db,ENABLE_PRIVATE_CAPTURE:'true'};
  assert.equal((await worker.fetch(req('https://other.example'),env)).status,403);
  const res=await worker.fetch(req(correctOrigin),env);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.ok,true);
  assert.doesNotMatch(JSON.stringify(body),/scanner_scans|growth_leads|exists: true/);
});
