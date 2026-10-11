import { assessHomepage, validatePublicHomepage } from './analyse.js';
import { isPublicIPv4, isPublicIPv6, robotsAllowsHomepage } from './security.js';
import { PRIVACY_VERSION, recordLead, recordOptInScan, eraseByReceipt, deleteExpired } from './records.js';

const MAX_HTML_BYTES = 1_500_000; // bounded partial HTML snapshot for large public homepages
const MAX_ROBOTS_BYTES = 64_000;
const REDIRECT_STATUSES = new Set([301,302,303,307,308]);
const LOCAL_ORIGINS = new Set(['http://127.0.0.1:8000','http://localhost:8000','http://localhost:5500']);
const captureEnabled = env => env.ENABLE_PRIVATE_CAPTURE === 'true' && Boolean(env.SCAN_DB);
const sameCanonicalHost = (a, b) => a.replace(/^www\./,'') === b.replace(/^www\./,'');

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://commercialgrowth.ie,https://www.commercialgrowth.ie').split(',').map(v => v.trim());
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'600'
  };
}
function json(data, status, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer', ...extra
  }});
}
function localTest(request) {
  const host = new URL(request.url).hostname;
  return (host === 'localhost' || host === '127.0.0.1') && LOCAL_ORIGINS.has(request.headers.get('Origin'));
}
async function readLimited(response, cap, allowPartial=false) {
  if (!response.body) throw new Error('Website returned no readable content.');
  // Only the homepage may be sampled. Robots rules must always be read fully.
  if (!allowPartial && Number(response.headers.get('content-length')) > cap) {
    throw new Error('Scanning permissions response was too large to verify.');
  }
  const reader=response.body.getReader();
  const chunks=[];
  let size=0, partial=false;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      const remaining=cap-size;
      if (value.byteLength>remaining) {
        if (!allowPartial) throw new Error('Scanning permissions response was too large to verify.');
        if (remaining>0) chunks.push(value.subarray(0,remaining));
        size=cap; partial=true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      size+=value.byteLength;
      // When Content-Length proves this is a large homepage, don't continue
      // downloading it after the bounded sample.
      if (allowPartial && size===cap && Number(response.headers.get('content-length'))>cap) {
        partial=true; await reader.cancel(); break;
      }
    }
  } finally {reader.releaseLock();}
  const result=new Uint8Array(size);
  let cursor=0;
  for (const chunk of chunks) {result.set(chunk,cursor); cursor+=chunk.length;}
  const html=new TextDecoder('utf-8',{fatal:false}).decode(result);
  return allowPartial ? {html,partial} : html;
}
async function requestWithTimeout(url, ms=8000, options={}) {
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms);
  try {
    return await fetch(url,{method:'GET',redirect:'manual',signal:ctrl.signal, ...options });
  } finally { clearTimeout(t); }
}
async function assertPublicDns(hostname) {
  // Require public responses on both A and AAAA, if present. Fail closed on
  // unresolved names, DoH outages and private/reserved DNS responses.
  let records=0;
  for (const [type,check] of [['A',isPublicIPv4],['AAAA',isPublicIPv6]]) {
    const address='https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(hostname)+'&type='+type;
    const res=await requestWithTimeout(address,3500,{ headers:{'Accept':'application/dns-json'} });
    if (!res.ok) throw new Error('Website address could not be verified safely.');
    const body=await res.text();
    if (body.length > 10_000) throw new Error('Website address could not be verified safely.');
    let parsed;
    try { parsed=JSON.parse(body); } catch {throw new Error('Website address could not be verified safely.');}
    if (parsed.Status !== 0 && parsed.Status !== 3) throw new Error('Website address could not be verified safely.');
    for (const answer of parsed.Answer || []) {
      if (answer.type !== (type === 'A' ? 1 : 28)) continue;
      if (!check(answer.data)) throw new Error('Website address resolves to a private or reserved network.');
      records++;
    }
  }
  if (!records) throw new Error('Website did not resolve to a public network address.');
}
async function checkRobots(url) {
  const robotsUrl=new URL('/robots.txt',url);
  const res=await requestWithTimeout(robotsUrl,6500,{headers:{'User-Agent':'CommercialGrowthScanner/0.3 (+https://commercialgrowth.ie)','Accept':'text/plain'}});
  if (res.status === 404 || res.status === 410) return;
  if (!res.ok) throw new Error('Scanning permissions could not be verified.');
  if (!robotsAllowsHomepage(await readLimited(res,MAX_ROBOTS_BYTES))) throw new Error('This website requests that automated scanning not access its homepage.');
}
async function fetchHomepage(url) {
  let current=url;
  const checked=new Set();
  for (let n=0;n<3;n++) {
    if (!checked.has(current.hostname)) {
      await assertPublicDns(current.hostname);
      await checkRobots(current);
      checked.add(current.hostname);
    }
    const res=await requestWithTimeout(current,9000,{headers:{'User-Agent':'CommercialGrowthScanner/0.3 (+https://commercialgrowth.ie)','Accept':'text/html,application/xhtml+xml;q=0.9'}});
    if (REDIRECT_STATUSES.has(res.status)) {
      const location=res.headers.get('location');
      if (!location) throw new Error('Website redirect was incomplete.');
      const destination=validatePublicHomepage(new URL(location,current).toString());
      if (!sameCanonicalHost(destination.hostname,url.hostname)) throw new Error('Website redirected to a different domain.');
      current=destination;
      continue;
    }
    if (!res.ok) throw new Error('The homepage returned HTTP '+res.status+'.');
    const contentType=(res.headers.get('content-type') || '').toLowerCase();
    if (!/^\s*(?:text\/html|application\/xhtml\+xml)\b/.test(contentType)) throw new Error('The homepage did not return readable HTML.');
    return {...await readLimited(res,MAX_HTML_BYTES,true),url:current.toString()};
  }
  throw new Error('The website redirected too many times.');
}
async function inspectHTML(html) {
  const found={title:'',description:'',heading:'',actionText:'',visibleCopy:'',hrefs:[],hasTelephone:false,hasEmail:false};
  const collect=(field,limit)=>({text(node){if(found[field].length < limit) found[field]+=node.text.slice(0,limit-found[field].length)+' ';}});
  const links={
    element(el) {
      const href=(el.getAttribute('href')||'').slice(0,240).toLowerCase();
      if(href && found.hrefs.length<100) found.hrefs.push(href);
      if(href.startsWith('mailto:')) found.hasEmail=true;
      if(href.startsWith('tel:')) found.hasTelephone=true;
      found.actionText += ' '+(el.getAttribute('aria-label')||el.getAttribute('title')||'').slice(0,100);
      found.actionText=found.actionText.slice(0,8000);
    },
    text(node){ found.actionText=(found.actionText+' '+node.text.slice(0,200)).slice(0,8000); }
  };
  const output=new HTMLRewriter()
    .on('title',collect('title',160))
    .on('h1',collect('heading',200))
    .on('p, li, h2, h3',collect('visibleCopy',10_000))
    .on('a',links)
    .on('button',collect('actionText',8000))
    .on('meta[name="description"]',{element(el){found.description=(el.getAttribute('content')||'').slice(0,280);}})
    .transform(new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
  await output.text();
  return found;
}
async function checkTurnstile(token,secret,ip,action='cg_scanner') {
  if(typeof token!=='string' || token.length<10 || token.length>2048) return false;
  const body=new URLSearchParams({secret,response:token});
  if(ip) body.set('remoteip',ip);
  const res=await requestWithTimeout('https://challenges.cloudflare.com/turnstile/v0/siteverify',6000,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
  if(!res.ok) return false;
  const data=await res.json();
  return data.success===true && data.action===action && ['commercialgrowth.ie','www.commercialgrowth.ie'].includes(data.hostname);
}
async function limitRequest(env,ip) {
  // Both bindings are deliberately required for public launch. Rate limits are
  // best-effort, not billing-grade counters. Add WAF rules if usage warrants.
  if (!env.SCANNER_GLOBAL_LIMIT || !env.SCANNER_CLIENT_LIMIT) return null;
  const aggregate=await env.SCANNER_GLOBAL_LIMIT.limit({key:'public-scan'});
  if(!aggregate.success) return false;
  const client=await env.SCANNER_CLIENT_LIMIT.limit({key:ip || 'unknown'});
  return client.success;
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    const origin=request.headers.get('Origin');
    const headers=cors(origin,env);
    if(path==='/health' && request.method==='GET') return json({ok:true,service:'commercial-growth-scanner',version:'0.3.0',ready:Boolean(env.TURNSTILE_SECRET && env.SCANNER_GLOBAL_LIMIT && env.SCANNER_CLIENT_LIMIT)},200);
    if(!['/scan','/lead','/capabilities','/withdraw'].includes(path)) return json({ok:false,error:'Not found.'},404);
    if(!headers) return json({ok:false,error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(path==='/capabilities' && request.method==='GET') return json({ok:true,scanHistory:captureEnabled(env),leadSharing:captureEnabled(env),withdrawal:captureEnabled(env),privacyVersion:PRIVACY_VERSION},200,headers);
    if(request.method!=='POST') return json({ok:false,error:'Method not allowed.'},405,headers);
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') return json({ok:false,error:'Expected JSON.'},400,headers);
    const length=Number(request.headers.get('content-length')||0);
    if(length>(path==='/lead'?4500:3000)) return json({ok:false,error:'Request too large.'},413,headers);
    let input;
    try {
      const content=await request.text();
      if(content.length>(path==='/lead'?4500:3000)) throw new Error('Too long');
      input=JSON.parse(content);
    } catch {return json({ok:false,error:'Invalid request.'},400,headers);}
    const local=localTest(request);
    // Never allow a published worker to scan before abuse controls are installed.
    if(!local && (!env.TURNSTILE_SECRET || !env.SCANNER_GLOBAL_LIMIT || !env.SCANNER_CLIENT_LIMIT)) {
      return json({ok:false,error:'Scanner setup is not complete yet.'},503,headers);
    }
    if(path==='/withdraw') {
      if(!captureEnabled(env)) return json({ok:false,error:'Private-record management is not available.'},503,headers);
      try {
        // No Turnstile required for withdrawal. The bearer code has 256 bits of
        // entropy, is never placed in a URL and is hashed before database lookup.
        if(typeof input?.code!=='string' || !/^[a-f0-9]{64}$/.test(input.code))
          return json({ok:false,error:'Enter a valid private deletion code.'},400,headers);
        // Fail closed if deployed abuse controls are absent.
        if(!local && !await limitRequest(env,request.headers.get('CF-Connecting-IP')||''))
          return json({ok:false,error:'Please retry shortly.'},429,headers);
        await eraseByReceipt(env.SCAN_DB,input.code);
        return json({ok:true,message:'Request processed. If a matching record existed, it has been deleted.'},200,headers);
      } catch {
        return json({ok:false,error:'Deletion could not be completed. Please contact us for assistance.'},503,headers);
      }
    }
    if(path==='/lead') {
      if(!captureEnabled(env)) return json({ok:false,error:'Snapshot sharing is not available yet.'},503,headers);
      try {
        const ip=request.headers.get('CF-Connecting-IP')||'';
        if(!local) {
          if(!await limitRequest(env,ip)) return json({ok:false,error:'Too many requests. Please try again later.'},429,headers);
          if(!await checkTurnstile(input?.turnstileToken,env.TURNSTILE_SECRET,ip,'cg_lead')) return json({ok:false,error:'Verification expired or unsuccessful. Please retry.'},403,headers);
        }
        const receipt=await recordLead(env.SCAN_DB,input);
        return json({ok:true,withdrawalCode:receipt.code},201,headers);
      } catch (error) {
        if(/^(Please |Enter |Invalid |Business link)/.test(String(error?.message))) return json({ok:false,error:error.message},400,headers);
        return json({ok:false,error:'Snapshot could not be shared right now. Please use email instead.'},503,headers);
      }
    }
    let target;
    try {target=validatePublicHomepage(input?.url);} catch(e){return json({ok:false,error:e.message},400,headers);}
    try {
      const ip=request.headers.get('CF-Connecting-IP')||'';
      if(!local) {
        const rate=await limitRequest(env,ip);
        if(!rate) return json({ok:false,error:'Too many scans right now. Please try again in a minute.'},429,headers);
        const verified=await checkTurnstile(input?.turnstileToken,env.TURNSTILE_SECRET,ip);
        if(!verified) return json({ok:false,error:'Verification expired or unsuccessful. Please retry.'},403,headers);
      }
      const {html,url,partial}=await fetchHomepage(target);
      const observations=await inspectHTML(html);
      const assessment=assessHomepage(observations,url);
      if (partial) {
        assessment.partial=true;
        assessment.summary='Limited homepage preview: only the first 1.5 MB of HTML was reviewed. Elements not found in that sample may exist elsewhere on the page. These are preliminary observations, not a complete website audit.';
        assessment.findings=(assessment.findings||[]).filter(f=>!/(not found|missing|no clear|could not find|not visible|absence)/i.test(String(f.observation||'')));
      }
      // Never store scanned domains without a visitor's affirmative choice.
      // If storage fails, preserve the free scan but do not claim that it was saved.
      assessment.scanSaved=false;
      if(input?.saveScan===true && input?.domainAuthority===true && input?.privacyVersion===PRIVACY_VERSION && captureEnabled(env)) {
        try { const receipt=await recordOptInScan(env.SCAN_DB,assessment); assessment.scanSaved=true; assessment.withdrawalCode=receipt.code; }
        catch { assessment.scanSaveError=true; }
      }
      return json(assessment,200,headers);
    } catch(error) {
      // A failed scan does not save a record: there is no safe moment to present a deletion receipt.
      const msg=String(error?.message||'');
      const allowed=/^(Enter |Invalid |Only |The homepage |The website |Website |Could not |This homepage |Scanning permissions)/.test(msg);
      return json({ok:false,error:allowed?msg.slice(0,180):'This website could not be reviewed automatically. Try another public homepage.'},422,headers);
    }
  },
  async scheduled(_event,env) {
    if(env.SCAN_DB) await deleteExpired(env.SCAN_DB);
  }
};
