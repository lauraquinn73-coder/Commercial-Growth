import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

const origins={Origin:'https://commercialgrowth.ie','Content-Type':'application/json'};
const env={ALLOWED_ORIGINS:'https://commercialgrowth.ie,http://127.0.0.1:8000',TURNSTILE_SECRET:'secret',SCANNER_GLOBAL_LIMIT:{limit:async()=>({success:true})},SCANNER_CLIENT_LIMIT:{limit:async()=>({success:true})}};
const request=(url,body,headers=origins)=>new Request(url,{method:'POST',headers,body:JSON.stringify(body)});

test('health indicates production binding readiness (not host deployment)',async()=>{
  const r=await worker.fetch(new Request('https://scanner.workers.dev/health'),env);
  assert.equal(r.status,200);
  assert.equal((await r.json()).ready,true);
});

test('origin validation rejects unsolicited cross-site calls',async()=>{
  const r=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://example.ie/'},{Origin:'https://unapproved.ie','Content-Type':'application/json'}),env);
  assert.equal(r.status,403);
});

test('deployment without security binding refuses scans (fail closed)',async()=>{
  const r=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://example.ie/'}),{ALLOWED_ORIGINS:'https://commercialgrowth.ie'});
  assert.equal(r.status,503);
});

test('invalid scan target is rejected before any third party HTTP fetch',async()=>{
  const r=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://127.0.0.1/'}),env);
  assert.equal(r.status,400);
});

test('global rate limiter blocks work before Turnstile or origin fetch',async()=>{
  const e={...env,SCANNER_GLOBAL_LIMIT:{limit:async()=>({success:false})}};
  const r=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://example.ie/'}),e);
  assert.equal(r.status,429);
});

test('invalid or missing security token prevents third-party access',async()=>{
  const r=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://example.ie/'}),env);
  assert.equal(r.status,403);
});

test('live Worker accepts valid token and produces observations from public HTML',async()=>{
  const previousFetch=globalThis.fetch;
  const previousRewriter=globalThis.HTMLRewriter;
  const fetched=[];
  // Simulate response parsing in Worker runtime; the HTMLRewriter API is a
  // Cloudflare-specific runtime feature, not available natively in Node.
  class RewriterStub {
    constructor(){this.handlers=[];}
    on(selector,handler){this.handlers.push([selector,handler]);return this;}
    transform(response){
      const self=this;
      return new Response(new ReadableStream({async start(controller){
        const html=await response.text();
        for(const [selector,handler] of self.handlers){
          if(selector==='title' && handler.text) handler.text({text:(/<title>(.*?)<\/title>/i.exec(html)||[])[1]||''});
          if(selector==='h1' && handler.text) handler.text({text:(/<h1>(.*?)<\/h1>/i.exec(html)||[])[1]||''});
          if(selector==='p, li, h2, h3' && handler.text) handler.text({text:'A business website with bookings and reviews'});
          if(selector==='a' && handler.element) handler.element({getAttribute:(key)=>key==='href'?'/book':null});
        }
        controller.enqueue(new TextEncoder().encode(html));controller.close();
      }}),{headers:{'Content-Type':'text/html'}});
    }
  }
  try {
    globalThis.HTMLRewriter=RewriterStub;
    globalThis.fetch=async(url,options={})=>{
      const target=String(url); fetched.push(target);
      if(target.includes('siteverify')) return Response.json({success:true,hostname:'commercialgrowth.ie',action:'cg_scanner'});
      if(target.includes('dns-query')) return Response.json({Status:0,Answer:target.includes('type=AAAA')?[]:[{type:1,data:'1.1.1.1'}]});
      if(target.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
      return new Response('<title>Test business</title><h1>Helpful team</h1><a href="/book">Book</a>',{headers:{'Content-Type':'text/html'}});
    };
    const res=await worker.fetch(request('https://scanner.workers.dev/scan',{url:'https://example.ie/',turnstileToken:'test-valid-token-xx'}),env);
    assert.equal(res.status,200);
    const payload=await res.json();
    assert.equal(payload.ok,true);
    assert.equal(payload.host,'example.ie');
    assert.equal(payload.findings.length,4);
    assert.ok(fetched.some(u=>u.includes('/robots.txt')));
    assert.ok(fetched.some(u=>u.includes('dns-query')));
    assert.ok(fetched.some(u=>u.includes('siteverify')));
  }finally {globalThis.fetch=previousFetch;globalThis.HTMLRewriter=previousRewriter;}
});
