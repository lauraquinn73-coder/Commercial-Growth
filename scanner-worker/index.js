import { assessHomepage, validatePublicHomepage } from './analyse.js';
import { isPublicIPv4, isPublicIPv6, robotsAllowsHomepage } from './security.js';

const MAX_HTML_BYTES = 260_000;
const MAX_ROBOTS_BYTES = 64_000;
const REDIRECT_STATUSES = new Set([301,302,303,307,308]);
const LOCAL_ORIGINS = new Set(['http://127.0.0.1:8000','http://localhost:8000','http://localhost:5500']);
const sameCanonicalHost = (a, b) => a.replace(/^www\./,'') === b.replace(/^www\./,'');

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://commercialgrowth.ie,https://www.commercialgrowth.ie').split(',').map(v => v.trim());
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
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
async function readLimited(response, cap) {
  if (!response.body) throw new Error('Website returned no readable content.');
  if (Number(response.headers.get('content-length')) > cap) throw new Error('This homepage is too large for the scanner.');
  let size=0;
  const reader=response.body.getReader();
  const chunks=[];
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) { await reader.cancel(); throw new Error('This homepage is too large for the scanner.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result=new Uint8Array(size);
  let cursor=0;
  for (const chunk of chunks) { result.set(chunk,cursor); cursor+=chunk.length; }
  return new TextDecoder('utf-8',{fatal:false}).decode(result);
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
  const res=await requestWithTimeout(robotsUrl,6500,{headers:{'User-Agent':'CommercialGrowthScanner/0.2 (+https://commercialgrowth.ie)','Accept':'text/plain'}});
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
    const res=await requestWithTimeout(current,9000,{headers:{'User-Agent':'CommercialGrowthScanner/0.2 (+https://commercialgrowth.ie)','Accept':'text/html,application/xhtml+xml;q=0.9'}});
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
    return {html:await readLimited(res,MAX_HTML_BYTES),url:current.toString()};
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
async function checkTurnstile(token,secret,ip) {
  if(typeof token!=='string' || token.length<10 || token.length>2048) return false;
  const body=new URLSearchParams({secret,response:token});
  if(ip) body.set('remoteip',ip);
  const res=await requestWithTimeout('https://challenges.cloudflare.com/turnstile/v0/siteverify',6000,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
  if(!res.ok) return false;
  const data=await res.json();
  return data.success===true && data.action==='cg_scanner' && ['commercialgrowth.ie','www.commercialgrowth.ie'].includes(data.hostname);
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
    if(path==='/health' && request.method==='GET') return json({ok:true,service:'commercial-growth-scanner',version:'0.2.0',ready:Boolean(env.TURNSTILE_SECRET && env.SCANNER_GLOBAL_LIMIT && env.SCANNER_CLIENT_LIMIT)},200);
    if(path!=='/scan') return json({ok:false,error:'Not found.'},404);
    if(!headers) return json({ok:false,error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(request.method!=='POST') return json({ok:false,error:'Method not allowed.'},405,headers);
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') return json({ok:false,error:'Expected JSON.'},400,headers);
    const length=Number(request.headers.get('content-length')||0);
    if(length>3000) return json({ok:false,error:'Request too large.'},413,headers);
    let input;
    try {
      const content=await request.text();
      if(content.length>3000) throw new Error('Too long');
      input=JSON.parse(content);
    } catch {return json({ok:false,error:'Invalid request.'},400,headers);}
    const local=localTest(request);
    // Never allow a published worker to scan before abuse controls are installed.
    if(!local && (!env.TURNSTILE_SECRET || !env.SCANNER_GLOBAL_LIMIT || !env.SCANNER_CLIENT_LIMIT)) {
      return json({ok:false,error:'Scanner setup is not complete yet.'},503,headers);
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
      const {html,url}=await fetchHomepage(target);
      const observations=await inspectHTML(html);
      return json(assessHomepage(observations,url),200,headers);
    } catch(error) {
      const msg=String(error?.message||'');
      const allowed=/^(Enter |Invalid |Only |The homepage |The website |Website |Could not |This homepage |Scanning permissions)/.test(msg);
      return json({ok:false,error:allowed?msg.slice(0,180):'This website could not be reviewed automatically. Try another public homepage.'},422,headers);
    }
  }
};
