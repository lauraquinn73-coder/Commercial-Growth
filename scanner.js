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
  const logWrap=document.getElementById('scanner-optin-wrap');
  const logConsent=document.getElementById('scanner-log-consent');
  const PRIVACY_VERSION='2026-10-11-v17-privacy2';
  const endpoint=String(cfg.scannerEndpoint||'').trim().replace(/\/$/,'');
  const sitekey=String(cfg.turnstileSiteKey||'').trim();
  const local=['localhost','127.0.0.1'].includes(location.hostname) && location.port==='8000' && endpoint==='http://127.0.0.1:8787';
  const production=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(endpoint) && /^[a-z0-9_-]{12,}$/i.test(sitekey);
  if(!(local||production)) return;
  document.getElementById('scanner')?.removeAttribute('hidden');
  document.querySelectorAll('[data-scanner-link]').forEach(el=>el.removeAttribute('hidden'));

  // Public capabilities disclose only whether optional D1-backed features are configured.
  fetch(endpoint+'/capabilities',{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'})
    .then(response=>response.ok?response.json():null)
    .then(flags=>{ if(flags?.scanHistory && logWrap) logWrap.hidden=false; })
    .catch(()=>{});
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
    if(data.partial) results.append(item('p','scanner-results-notice','This is a limited preview of a large website. Missing elements cannot be confirmed from this sample.'));
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
    const action=item('button','button primary','Continue to the Growth Check →');
    action.type='button';
    action.addEventListener('click',()=>{
      window.CG_prefillBusinessUrl?.(data.pageUrl);
      window.CG_trackEvent?.('cg_scanner_to_check',{source:'scanner_results'});
      window.CG_openCheck?.();
    });
    foot.append(action,item('p','scanner-legal-note','Automated observations are preliminary. Websites using JavaScript, login restrictions or anti-bot measures may not be fully analysed.'));
    if(data.scanSaved && data.withdrawalCode) {
      const panel=item('section','scanner-results-notice');
      panel.append(item('p','','Your optional domain record was saved for up to 30 days. Keep this private deletion code: it allows anyone holding it to remove the record. It will not be emailed or stored on this device.'));
      const code=item('code','',data.withdrawalCode);
      code.style.overflowWrap='anywhere';
      const copy=item('button','button secondary','Copy deletion code'); copy.type='button';
      copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(data.withdrawalCode);copy.textContent='Code copied';}
        catch{copy.textContent='Select and copy the code above';}
      });
      const erase=item('button','button secondary','Withdraw consent and delete record');erase.type='button';
      const reply=item('p','');reply.setAttribute('role','status');
      erase.addEventListener('click',async()=>{
        erase.disabled=true;reply.textContent='Submitting deletion request…';
        try{
          const response=await fetch(endpoint+'/withdraw',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:data.withdrawalCode})});
          if(!response.ok) throw Error('Deletion was unavailable. Keep your code and use the Privacy Policy deletion form.');
          reply.textContent='Deletion processed. Your optional stored scan record has been removed.';
          code.remove();copy.remove();erase.remove();
        }catch(err){reply.textContent=err.message;erase.disabled=false;}
      });
      panel.append(code,copy,erase,reply);results.append(panel);
    } else if(data.scanSaveError) results.append(item('p','scanner-results-notice','The report worked, but optional domain storage failed; no record was saved.'));
    results.append(foot);
  }
  function showManualCheck(url) {
    results.hidden=false;
    results.replaceChildren();
    const panel=item('div','scanner-results-footer');
    panel.append(item('h4','','Continue without an automated scan'));
    panel.append(item('p','','Some websites restrict automated access or use a homepage address the scanner cannot currently process. You can still explore commercial gaps with the free Growth Check.'));
    const button=item('button','button secondary','Continue to the Growth Check →');
    button.type='button';
    button.addEventListener('click',()=>{
      if(url) window.CG_prefillBusinessUrl?.(url);
      window.CG_trackEvent?.('cg_scanner_fallback_to_check');
      window.CG_openCheck?.();
    });
    panel.append(button);
    results.append(panel);
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
    try{url=normalise(input.value);}catch(err){message(err.message,'error');showManualCheck();return;}
    if(production && !verifiedToken) {message('Please complete the scanner security verification first.','error');return;}
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25_000);
    submit.disabled=true;
    results.hidden=true;
    results.replaceChildren();
    window.CG_trackEvent?.('cg_scanner_started');
    message('Analysing the accessible homepage. We are checking page structure and commercial signals…','loading');
    try {
      const response=await fetch(endpoint+'/scan',{
        method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url, ...(logWrap && !logWrap.hidden && logConsent?.checked?{saveScan:true,domainAuthority:true,privacyVersion:PRIVACY_VERSION}:{}), ...(production?{turnstileToken:verifiedToken}:{})}),
        signal:controller.signal
      });
      let payload;
      try{payload=await response.json();}catch{throw new Error('The scanner service returned an unreadable response.');}
      if(!response.ok || payload?.ok!==true) throw new Error(payload?.error||'The scanner could not complete this review.');
      message('Initial public homepage review complete.','success');
      render(payload);
      window.CG_trackEvent?.('cg_scanner_completed',{partial:payload.partial===true?'yes':'no'});
      if(logConsent) logConsent.checked=false;
    } catch(err) {
      window.CG_trackEvent?.('cg_scanner_failed',{category:err.name==='AbortError'?'timeout':'unavailable'});
      message(err.name==='AbortError'?'This website took too long to respond. You can still use the Growth Check.':
          err instanceof TypeError?'Could not reach the scanner service. You can still use the Growth Check.':err.message,'error');
      showManualCheck(url);
    } finally {
      clearTimeout(timeout);
      submit.disabled=false;
      if(production) resetChallenge();
    }
  });
})();
