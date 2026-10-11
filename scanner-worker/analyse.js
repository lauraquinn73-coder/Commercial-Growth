import { acceptedHostname } from './security.js';

// Deterministic, evidence-aware commercial observations from HTML features.
// Not an AI model; no invented sales metrics or arbitrary numerical score.

export function validatePublicHomepage(raw) {
  if (typeof raw !== 'string' || raw.length > 250) throw new Error('Enter a valid public HTTPS homepage.');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid website address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Only public HTTPS websites on the default port are supported.');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Enter the website homepage without a path or query.');
  const host = url.hostname.toLowerCase();
  if (host.length > 253 || !host.includes('.') || host.endsWith('.') || host.startsWith('[') ||
      /(?:^|\.)(?:local|internal|lan|test|invalid|example|onion|arpa|localhost|home)$/.test(host) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      !acceptedHostname(host) || host.includes('..')) {
    throw new Error('Only public domain names are supported.');
  }
  return url;
}

const text = (value, max = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

export function assessHomepage(features, url) {
  const host = new URL(url).hostname;
  const navigation = features.actionText || '';
  const anchorStrings = [...(features.hrefs || []), navigation].join(' ').toLowerCase();
  const copy = [features.description, features.heading, features.visibleCopy].filter(Boolean).join(' ').toLowerCase();
  const findings = [];
  const push = (category, title, observation, why, action) => {
    findings.push({ category, title, observation, why, action });
  };

  const conversion = /book|appoint|reserv|contact|enquir|inquir|consult|schedule|quote|order|shop|buy|checkout|cart|get.started|sign.up|request|apply|call.us|call.now|whatsapp/.test(anchorStrings);
  const directContact = features.hasTelephone || features.hasEmail;
  const trust = /testimon|review|rating|case.stud|client.stor|our.work|portfolio|certif|accredit|verified|award/.test(anchorStrings + ' ' + copy);

  if (conversion) {
    push('Conversion', 'A customer action route was detected',
      'The homepage HTML includes language or links associated with booking, buying or making contact.',
      'Having a pathway is useful, but this scan cannot confirm whether the action is easy to find on a mobile screen.',
      'Test the journey on a real phone: can a new visitor identify and complete the next step without guidance?');
  } else {
    push('Conversion', 'Make the next step unmistakable',
      'No obvious booking, purchase, quote or enquiry wording was detected in the accessible homepage links or buttons.',
      'A visitor may struggle to understand what to do after deciding they are interested. JavaScript-rendered buttons may not have been visible to this scan.',
      'Check your mobile homepage and consider one primary action that is visible and consistently worded.');
  }
  if (!features.description) {
    push('Offer clarity', 'Clarify the homepage promise',
      'No meaningful meta description was found in the accessible homepage HTML.',
      'This is a search-result messaging opportunity, not proof that the on-page offer is unclear.',
      'Write a concise description of who you help, what you provide and why someone should click through.');
  } else if (!features.heading) {
    push('Offer clarity', 'Check the main headline',
      'We could not detect an H1 heading in the accessible homepage HTML.',
      'A strong, prominent main headline helps visitors orient themselves. Some sites render headings using JavaScript.',
      'Review the first screen and make the service, customer and outcome immediately understandable.');
  } else {
    push('Offer clarity', 'Validate the value proposition with new visitors',
      `The homepage contains a main headline: “${text(features.heading, 110)}”.`,
      'A headline is present, but presence alone does not establish whether the offer is understood or differentiated.',
      'Ask someone unfamiliar with the business to explain who it serves, what it sells and the next step after five seconds.');
  }
  if (trust) {
    push('Customer trust', 'Evidence of credibility appears in the page',
      'The homepage contains language or links associated with reviews, testimonials, past work or credentials.',
      'Trust cues can reduce uncertainty, but their presence does not verify authenticity or visual prominence.',
      'Confirm that genuine, specific evidence is placed near the decisions where visitors need reassurance.');
  } else {
    push('Customer trust', 'Look for opportunities to reduce buyer uncertainty',
      'The accessible homepage did not reveal obvious review, case-study, testimonial or credential language.',
      'Prospective customers often need reassurance, although relevant proof may live on other pages or be dynamically loaded.',
      'Consider relevant and authentic examples of work, customer feedback or qualifications where appropriate.');
  }
  if (!directContact) {
    push('Contact friction', 'Check access to a direct contact route',
      'No telephone or email link was detected in the accessible homepage HTML.',
      'Some visitors prefer to contact directly. A separate contact form may still be available.',
      'Check whether mobile visitors can quickly find a reliable contact method without unnecessary steps.');
  }
  return {
    ok: true,
    host,
    pageUrl: url,
    siteTitle: text(features.title, 100) || host,
    summary: `A preliminary review of the public homepage at ${host}. The observations below describe visible HTML signals and areas worth checking, not verified revenue or conversion performance.`,
    scope: 'Public homepage HTML only; no internal data, JavaScript rendering, other pages, or mobile screenshot.',
    findings: findings.slice(0, 4)
  };
}
