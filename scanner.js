/* Commercial Growth Intelligence — browser client V0.2.
 * No metrics are invented; results are rendered from a successful Worker response.
 */
(() => {
  'use strict';
  const form=document.getElementById('scanner-form');
  if(!form) return;
  const input=document.getElementById('scanner-url');
  const submit=document.getElementById('scanner-submit');
  const status=document.getElementById('scanner-status');
  const results=document.getElementById('scanner-results');
  const challenge=document.getElementById('scanner-verification');
  const cfg=window.CG_CONFIG||{};
  const endpoint=String(cfg.scannerEndpoint||'').trim().replace(/\/$/,'');
  const sitekey=String(cfg.turnstileSiteKey||'').trim();
  const local=['localhost','127.0.0.1'].includes(location.hostname) && location.port==='8000' && endpoint==='http://127.0.0.1:8787';
  const production=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(endpoint) && /^[a-z0-9_-]{12,}$/i.test(sitekey);
  if(!(local||production)) return;
  document.getElementById('scanner')?.removeAttribute('hidden');
  document.querySelectorAll('[data-scanner-link]').forEach(el=>el.removeAttribute('hidden'));

  let widget=null;
  let verifiedToken='';
  function message(value,state='') {
    status.textContent=value;
    status.dataset.state=state;
  }
  function item(tag,cls,text) {
    const el=document.createElement(tag);
    if(cls) el.className=cls;
    if(text!==undefined) el.textContent=String(text);
    return el;
  }
  function normalise(raw) {
    let value=String(raw||'').trim();
    if(!value || value.length>250) throw new Error('Enter a website address under 250 characters.');
    if(!/^https?:\/\//i.test(value)) value='https://'+value;
    let url;
    try{url=new URL(value);}catch{throw new Error('Please enter a valid business website address.');}
    if(url.protocol!=='https:' || url.username || url.password || url.port || url.pathname!=='/' || url.search || url.hash) {
      throw new Error('Enter the public HTTPS homepage only, without a login, path, query or port.');
    }
    const host=url.hostname.toLowerCase();
    if(host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes('.') ||
        /(?:^|\.)(?:local|lan|internal|test|invalid|example|onion|arpa|localhost|home)$/.test(host)) {
      throw new Error('Enter a publicly accessible business domain, not a local address.');
    }
    return url.origin+'/';
  }
  function render(data) {
    results.replaceChildren();
    results.hidden=false;
    results.append(item('h4','',data.siteTitle||data.host||'Website snapshot'));
    results.append(item('p','scanner-results-summary',data.summary||'Preliminary public homepage review.'));
    const findings=Array.isArray(data.findings)?data.findings:[];
    findings.slice(0,4).forEach(f=>{
      const el=item('article','scanner-result-card');
      el.append(
        item('span','scanner-tag',f.category||'Observation'),
        item('h5','',f.title||'Review this opportunity'),
        item('p','',f.observation||''),
        item('p','','Why it matters: '+(f.why||'This deserves a closer look.')),
        item('p','','Next step: '+(f.action||'Validate the live customer experience.'))
      );
      results.append(el);
    });
    const foot=item('div','scanner-results-footer');
    foot.append(item('h4','','Go deeper than the homepage'));
    foot.append(item('p','','A public HTML scan cannot verify conversions, lost sales, website usability or internal operations. The free Commercial Growth Check explores the business behind the site.'));
    const action=item('a','button primary','Take the Growth Check →');
    action.href='#check-title';
    foot.append(action,item('p','scanner-legal-note','Automated observations are preliminary. Websites using JavaScript, login restrictions or anti-bot measures may not be fully analysed.'));
    results.append(foot);
  }
  function resetChallenge() {
    verifiedToken='';
    if(widget!==null && window.turnstile) {
      try{window.turnstile.reset(widget);}catch{}
    }
  }
  if(production) {
    challenge.hidden=false;
    challenge.append(item('p','scanner-field-help','One quick security check protects the free scanner from automated abuse.'));
    const host=item('div','scanner-turnstile');
    host.id='scanner-turnstile-widget';
    challenge.append(host);
    // Cloudflare only loads on pages where the public scanner is configured.
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.onload=()=>{
      if(!window.turnstile){message('Verification could not load. Please try again later.','error');return;}
      widget=window.turnstile.render('#scanner-turnstile-widget',{
        sitekey,theme:'light',size:'flexible',appearance:'interaction-only',action:'cg_scanner',
        callback:token=>{verifiedToken=token;},
        'expired-callback':()=>{verifiedToken='';message('Verification expired. Please try again.','error');},
        'error-callback':()=>{verifiedToken='';message('Verification could not complete. Please retry.','error');}
      });
    };
    script.onerror=()=>message('The security verification is unavailable. Please try again later.','error');
    document.head.append(script);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    let url;
    try{url=normalise(input.value);}catch(err){message(err.message,'error');return;}
    if(production && !verifiedToken) {message('Please complete the scanner security verification first.','error');return;}
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25_000);
    submit.disabled=true;
    results.hidden=true;
    results.replaceChildren();
    message('Reviewing accessible public homepage signals. This can take a few seconds…','loading');
    try {
      const response=await fetch(endpoint+'/scan',{
        method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url,...(production?{turnstileToken:verifiedToken}:{})}),
        signal:controller.signal
      });
      let payload;
      try{payload=await response.json();}catch{throw new Error('The scanner service returned an unreadable response.');}
      if(!response.ok || payload?.ok!==true) throw new Error(payload?.error||'The scanner could not complete this review.');
      message('Initial public homepage review complete.','success');
      render(payload);
    } catch(err) {
      message(err.name==='AbortError'?'This website took too long to respond. Please try another homepage.':
          err instanceof TypeError?'Could not reach the scanner service. Please try again later.':err.message,'error');
    } finally {
      clearTimeout(timeout);
      submit.disabled=false;
      if(production) resetChallenge();
    }
  });
})();
