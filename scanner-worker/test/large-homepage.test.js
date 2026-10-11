import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

// Regression for the original “homepage too big” bug: a normal business page
// can exceed the cap; the scan should still return bounded partial findings.
test('HTML over 1.5 MB yields a clearly labelled partial report, not a size error',async()=>{
  const originalFetch=globalThis.fetch;
  const originalRewriter=globalThis.HTMLRewriter;
  class MinimalRewriter {
    on(){return this;}
    transform(response){return response;}
  }
  let homepageRequests=0;
  try {
    globalThis.HTMLRewriter=MinimalRewriter;
    globalThis.fetch=async(url)=>{
      const address=String(url);
      if(address.includes('dns-query'))return Response.json({Status:0,Answer:address.includes('type=AAAA')?[]:[{type:1,data:'1.1.1.1'}]});
      if(address.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');
      homepageRequests++;
      return new Response('<html><title>Large</title><body>'+ 'x'.repeat(1_700_000) + '</body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Content-Length':'1700052'}});
    };
    const request=new Request('http://127.0.0.1:8787/scan',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify({url:'https://largesite.ie/'})});
    const res=await worker.fetch(request,{ALLOWED_ORIGINS:'http://localhost:8000'});
    const data=await res.json();
    assert.equal(res.status,200);
    assert.equal(data.ok,true);
    assert.equal(data.partial,true);
    assert.match(data.summary,/Limited homepage preview/);
    assert.equal(homepageRequests,1);
  } finally { globalThis.fetch=originalFetch; globalThis.HTMLRewriter=originalRewriter; }
});
