// Optional, consent-led storage: record the notice version and purpose, and
// store only a SHA-256 digest of a randomly generated deletion receipt.
// A receipt is a bearer secret, returned only once. Never log or analyse it.
export const PRIVACY_VERSION = '2026-10-11-v17-privacy2';
const DAY=86400;
const tidy=(value,limit)=>String(value??'').trim().slice(0,limit);
const allowedChoices={
  challenge:new Set(['acquisition','conversion','follow_up','retention','journey','direction','unsure']),
  monthly_enquiries:new Set(['0-10','11-30','31-100','100+','unknown']),
  conversion_visibility:new Set(['yes','roughly','no','not_applicable']),
  follow_up:new Set(['always','sometimes','rarely','never','unknown']),
  repeat_potential:new Set(['high','some','low','unknown']),
  support_interest:new Set(['audit_only','implementation','unsure']),
  timeline:new Set(['now','month','later','research']),
  heard_from:new Set(['instagram','referral','linkedin','google','outreach','other','prefer_not'])
};
const allowedPriority=new Set(['acquisition','conversion','follow_up','retention','measurement','journey','offer']);
export function validateLeadPayload(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.shareConsent!==true||value.privacyVersion!==PRIVACY_VERSION)
    throw new Error('Please confirm that you want to share your snapshot.');
  const name=tidy(value.name,81), email=tidy(value.email,255), business=tidy(value.business,121);
  if(!name||name.length>80||!business||business.length>120||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254)
    throw new Error('Enter your name, business and a valid email address.');
  const answers=value.answers;
  if(!answers||typeof answers!=='object'||Array.isArray(answers)) throw new Error('Please complete the Growth Check first.');
  const clean={offer:tidy(answers.offer,500)};
  if(!clean.offer) throw new Error('A short description of the business is required.');
  if(answers.business_url){
    const raw=String(answers.business_url);
    if(raw.length>300) throw new Error('Business link is too long.');
    let u;
    try{u=new URL(raw);}catch{throw new Error('Please use a valid HTTPS business link.');}
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||
       !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)||
       /(?:^|\.)(?:local|internal|lan|localhost|onion|invalid|test)$/.test(u.hostname))
      throw new Error('Please use a public HTTPS business link without tracking parameters.');
    clean.business_url=u.origin+u.pathname.slice(0,200);
  }
  for(const [key,vals] of Object.entries(allowedChoices)){
    const raw=answers[key];
    if(key==='challenge'){
      if(!Array.isArray(raw)||raw.length<1||raw.length>3||new Set(raw).size!==raw.length||!raw.every(x=>vals.has(x)))
        throw new Error('Please complete the Growth Check first.');
      clean[key]=raw;
    }else{
      if(typeof raw!=='string'||!vals.has(raw)) throw new Error('Please complete the Growth Check first.');
      clean[key]=raw;
    }
  }
  if(!Array.isArray(value.priorities)||value.priorities.length>3||!value.priorities.every(x=>allowedPriority.has(x)))
    throw new Error('Invalid snapshot areas.');
  return {name,email,business,answers:clean,priorities:value.priorities};
}
export function newReceipt(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export async function receiptHash(receipt){
  if(typeof receipt!=='string'||!/^[a-f0-9]{64}$/.test(receipt)) throw new Error('Enter a valid private deletion code.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(receipt));
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function recordOptInScan(db,assessment,now=Math.floor(Date.now()/1000)){
  const code=newReceipt(), digest=await receiptHash(code);
  const themes=(assessment.findings||[]).map(x=>tidy(x.category,50)).slice(0,4);
  await db.prepare(`INSERT INTO scanner_scans
    (hostname,themes_json,partial,outcome,created_at,expires_at,privacy_version,consent_at,consent_purpose,receipt_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
   .bind(tidy(assessment.host,253),JSON.stringify(themes),assessment.partial===true?1:0,
     'completed',now,now+30*DAY,PRIVACY_VERSION,now,'optional_scanner_history',digest).run();
  return {code};
}
export async function recordLead(db,value,now=Math.floor(Date.now()/1000)){
  const lead=validateLeadPayload(value), code=newReceipt(),digest=await receiptHash(code);
  await db.prepare(`INSERT INTO growth_leads
    (id,name,email,business,answers_json,priorities_json,created_at,expires_at,privacy_version,consent_at,consent_purpose,receipt_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),lead.name,lead.email,lead.business,JSON.stringify(lead.answers),
      JSON.stringify(lead.priorities),now,now+365*DAY,PRIVACY_VERSION,now,'voluntary_diagnostic_enquiry',digest).run();
  return {code};
}
export async function eraseByReceipt(db,code){
  const hash=await receiptHash(code);
  // Deliberately do not disclose whether the provided code matched a record.
  const scan=await db.prepare('DELETE FROM scanner_scans WHERE receipt_hash = ?').bind(hash).run();
  const lead=await db.prepare('DELETE FROM growth_leads WHERE receipt_hash = ?').bind(hash).run();
  return (scan.meta?.changes||0)+(lead.meta?.changes||0)>0;
}
export async function deleteExpired(db,now=Math.floor(Date.now()/1000)){
  await db.prepare('DELETE FROM scanner_scans WHERE expires_at <= ?').bind(now).run();
  await db.prepare('DELETE FROM growth_leads WHERE expires_at <= ?').bind(now).run();
}
