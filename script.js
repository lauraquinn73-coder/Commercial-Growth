const CONFIG = window.CG_CONFIG || {};
const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

// Reveal animations
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion || !('IntersectionObserver' in window)) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// Attribution: stored for the session and attached to submitted leads.
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const params = new URLSearchParams(window.location.search);
const existingAttribution = JSON.parse(sessionStorage.getItem('cg_attribution') || '{}');
const attribution = { ...existingAttribution };
attributionKeys.forEach((key) => {
  if (params.get(key)) attribution[key] = params.get(key);
});
if (!attribution.first_referrer) attribution.first_referrer = document.referrer || 'direct';
if (!attribution.landing_page) attribution.landing_page = window.location.href;
sessionStorage.setItem('cg_attribution', JSON.stringify(attribution));

function createLeadId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `cg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
const leadId = sessionStorage.getItem('cg_lead_id') || createLeadId();
sessionStorage.setItem('cg_lead_id', leadId);

// Consent-aware GA4. PII is never sent to analytics.
let analyticsReady = false;
function loadAnalytics() {
  const id = (CONFIG.gaMeasurementId || '').trim();
  if (!id || analyticsReady) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', id, { send_page_view: true });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  analyticsReady = true;
}
function trackEvent(name, details = {}) {
  if (!analyticsReady || typeof window.gtag !== 'function') return;
  const safe = { ...details, lead_id: leadId };
  // Do not ever add name, email, business name or free-text answers here.
  gtag('event', name, safe);
}

const cookieBanner = document.getElementById('cookie-banner');
const consent = localStorage.getItem('cg_analytics_consent');
if (!consent && cookieBanner) cookieBanner.hidden = false;
if (consent === 'yes') loadAnalytics();
document.getElementById('cookie-allow')?.addEventListener('click', () => {
  localStorage.setItem('cg_analytics_consent', 'yes');
  cookieBanner.hidden = true;
  loadAnalytics();
});
document.getElementById('cookie-essential')?.addEventListener('click', () => {
  localStorage.setItem('cg_analytics_consent', 'no');
  cookieBanner.hidden = true;
});

// Track lower-friction contact intent without collecting any personal data in analytics.
document.getElementById('contact-email')?.addEventListener('click', () => {
  trackEvent('cg_email_clicked', { placement: 'contact_section' });
});
document.getElementById('contact-instagram')?.addEventListener('click', () => {
  trackEvent('cg_instagram_clicked', { placement: 'contact_section' });
});
document.getElementById('footer-email')?.addEventListener('click', () => {
  trackEvent('cg_email_clicked', { placement: 'footer' });
});

const questions = [
  {
    id: 'name',
    title: 'First, what should I call you?',
    help: 'Just your first name is perfect.',
    type: 'text',
    placeholder: 'Your name',
    required: true,
    autocomplete: 'given-name'
  },
  {
    id: 'business',
    title: 'What is the name of your business?',
    type: 'text',
    placeholder: 'Business name',
    required: true,
    autocomplete: 'organization'
  },
  {
    id: 'offer',
    title: 'What does the business actually sell?',
    help: 'A sentence or two is enough. Tell me what customers pay you for.',
    type: 'textarea',
    placeholder: 'We sell…',
    required: true
  },
  {
    id: 'business_url',
    title: 'Where can I take a look at the business?',
    help: 'Website, Instagram or another public link.',
    type: 'url',
    placeholder: 'https://…',
    required: true
  },
  {
    id: 'email',
    title: 'Where should I send anything related to your Check?',
    help: 'This is for your enquiry only. It does not subscribe you to marketing.',
    type: 'email',
    placeholder: 'you@business.ie',
    required: true,
    autocomplete: 'email'
  },
  {
    id: 'challenge',
    title: 'What feels like the biggest commercial question right now?',
    help: 'Select up to 3. Choose every area that genuinely feels relevant.',
    type: 'multi',
    max: 3,
    options: [
      ['acquisition', 'We need more of the right enquiries'],
      ['conversion', 'We get interest, but conversion could be stronger'],
      ['follow_up', 'Follow-up feels inconsistent'],
      ['retention', 'Customers buy, but repeat business could be stronger'],
      ['journey', 'The customer journey feels harder than it should'],
      ['direction', 'We are busy, but I am not sure where growth should come from next'],
      ['unsure', 'I know something is being missed, I just cannot pinpoint it']
    ]
  },
  {
    id: 'monthly_enquiries',
    title: 'Roughly how many new enquiries or leads does the business receive in a typical month?',
    help: 'An estimate is completely fine.',
    type: 'choice',
    options: [
      ['0-10', '0–10'],
      ['11-30', '11–30'],
      ['31-100', '31–100'],
      ['100+', '100+'],
      ['unknown', 'I genuinely do not know']
    ]
  },
  {
    id: 'conversion_visibility',
    title: 'Do you know what percentage of those enquiries become paying customers?',
    type: 'choice',
    options: [
      ['yes', 'Yes, we track it'],
      ['roughly', 'Roughly'],
      ['no', 'No'],
      ['not_applicable', 'That is not how our sales process works']
    ]
  },
  {
    id: 'follow_up',
    title: 'What normally happens when somebody is interested but does not buy straight away?',
    type: 'choice',
    options: [
      ['always', 'We have a consistent follow-up process'],
      ['sometimes', 'We follow up sometimes'],
      ['rarely', 'It depends who handles the enquiry'],
      ['never', 'There is no real follow-up process'],
      ['unknown', 'I am not sure']
    ]
  },
  {
    id: 'repeat_potential',
    title: 'Could a typical customer realistically buy from you again or buy something else?',
    type: 'choice',
    options: [
      ['high', 'Yes, repeat or additional sales are a big opportunity'],
      ['some', 'Sometimes'],
      ['low', 'Most purchases are naturally one-off'],
      ['unknown', 'I have never really looked at it that way']
    ]
  },
  {
    id: 'support_interest',
    title: 'If we found a worthwhile commercial gap, what would you want next?',
    type: 'choice',
    options: [
      ['audit_only', 'A clear diagnosis and action plan'],
      ['implementation', 'Help actually implementing the changes too'],
      ['unsure', 'I would want to see what you find first']
    ]
  },
  {
    id: 'timeline',
    title: 'How soon would you realistically act if there was something worth fixing?',
    type: 'choice',
    options: [
      ['now', 'Now / within the next few weeks'],
      ['month', 'Within 1–3 months'],
      ['later', 'Later this year'],
      ['research', 'I am mostly exploring right now']
    ]
  },
  {
    id: 'heard_from',
    title: 'Last one. How did you find Commercial Growth?',
    type: 'choice',
    options: [
      ['instagram', 'Instagram'],
      ['referral', 'Someone recommended Laura'],
      ['linkedin', 'LinkedIn'],
      ['google', 'Google / search'],
      ['outreach', 'Laura contacted me'],
      ['other', 'Somewhere else']
    ]
  }
];

const modal = document.getElementById('growth-check');
const form = document.getElementById('diagnostic-form');
const snapshotStage = document.getElementById('snapshot-stage');
const progress = document.getElementById('check-progress');
const stepLabel = document.getElementById('check-step-label');
const backButton = document.getElementById('check-back');
let questionIndex = -1;
let answers = JSON.parse(sessionStorage.getItem('cg_check_answers') || '{}');
let leadSubmitted = false;

function saveDraft() {
  sessionStorage.setItem('cg_check_answers', JSON.stringify(answers));
}

function openCheck() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('check-open');

  if (questionIndex === -1 && !snapshotStage.classList.contains('active')) {
    questionIndex = 0;
    renderQuestion();
    backButton.hidden = true;
    trackEvent('cg_check_started');
  } else if (questionIndex > 0) {
    backButton.hidden = false;
  }

  trackEvent('cg_check_opened', { source: 'site_cta' });
}
function closeCheck() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('check-open');
  if (questionIndex >= 0 && !leadSubmitted) trackEvent('cg_check_closed', { question_number: questionIndex + 1 });
}

document.querySelectorAll('.js-open-check').forEach((button) => button.addEventListener('click', openCheck));
document.getElementById('check-close')?.addEventListener('click', closeCheck);
modal?.addEventListener('click', (e) => { if (e.target === modal) closeCheck(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal?.classList.contains('open')) closeCheck(); });

if (window.location.hash === '#check') openCheck();

backButton?.addEventListener('click', () => {
  if (snapshotStage.classList.contains('active')) return;
  if (questionIndex > 0) {
    questionIndex -= 1;
    renderQuestion();
  }
  backButton.hidden = questionIndex <= 0;
});

function updateProgress() {
  const pct = questionIndex < 0 ? 0 : Math.round(((questionIndex + 1) / questions.length) * 100);
  progress.style.width = `${Math.min(pct, 100)}%`;
  stepLabel.textContent = questionIndex >= 0 ? `Question ${questionIndex + 1} of ${questions.length}` : '';
}

function renderQuestion() {
  snapshotStage.classList.remove('active');
  form.style.display = 'grid';
  const q = questions[questionIndex];
  updateProgress();
  backButton.hidden = questionIndex <= 0;
  form.innerHTML = '';
  const checkBody = document.getElementById('check-body');
  if (checkBody) checkBody.scrollTop = 0;

  const card = document.createElement('div');
  card.className = 'question-card';
  card.innerHTML = `<div class="question-copy"><p class="question-kicker">Question ${questionIndex + 1}</p><h2>${q.title}</h2>${q.help ? `<p class="question-help">${q.help}</p>` : ''}</div>`;

  if (q.type === 'choice') {
    const grid = document.createElement('div');
    grid.className = 'option-grid';
    q.options.forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `option-button${answers[q.id] === value ? ' selected' : ''}`;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', answers[q.id] === value ? 'true' : 'false');
      btn.addEventListener('click', () => {
        answers[q.id] = value;
        saveDraft();
        grid.querySelectorAll('.option-button').forEach((b) => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
        window.setTimeout(nextQuestion, 140);
      });
      grid.appendChild(btn);
    });
    card.appendChild(grid);
  } else if (q.type === 'multi') {
    const selected = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [];
    answers[q.id] = selected;

    const grid = document.createElement('div');
    grid.className = 'option-grid multi-option-grid';

    const actions = document.createElement('div');
    actions.className = 'multi-actions';
    const count = document.createElement('span');
    count.className = 'selection-count';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'button primary multi-continue';
    next.textContent = 'Continue';

    const refreshMultiState = () => {
      const values = answers[q.id] || [];
      const atMax = values.length >= (q.max || 3);
      count.textContent = `${values.length} of ${q.max || 3} selected`;
      next.disabled = values.length === 0;
      grid.querySelectorAll('.option-button').forEach((button) => {
        const isSelected = values.includes(button.dataset.value);
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        button.disabled = atMax && !isSelected;
      });
    };

    q.options.forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = value;
      btn.className = 'option-button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        let values = answers[q.id] || [];
        const existingIndex = values.indexOf(value);

        // “I cannot pinpoint it” is intentionally exclusive; selecting a specific
        // commercial issue removes it, and selecting it clears the specific issues.
        if (value === 'unsure') {
          values = existingIndex >= 0 ? [] : ['unsure'];
        } else {
          values = values.filter((item) => item !== 'unsure');
          const updatedIndex = values.indexOf(value);
          if (updatedIndex >= 0) {
            values.splice(updatedIndex, 1);
          } else if (values.length < (q.max || 3)) {
            values.push(value);
          }
        }

        answers[q.id] = values;
        saveDraft();
        refreshMultiState();
      });
      grid.appendChild(btn);
    });

    next.addEventListener('click', () => {
      if ((answers[q.id] || []).length > 0) nextQuestion();
    });
    actions.appendChild(count);
    actions.appendChild(next);
    card.appendChild(grid);
    card.appendChild(actions);
    refreshMultiState();
  } else {
    const input = document.createElement(q.type === 'textarea' ? 'textarea' : 'input');
    input.className = q.type === 'textarea' ? 'question-textarea' : 'question-input';
    input.id = `q-${q.id}`;
    input.name = q.id;
    input.placeholder = q.placeholder || '';
    if (q.type !== 'textarea') input.type = q.type;
    if (q.autocomplete) input.autocomplete = q.autocomplete;
    input.value = answers[q.id] || '';
    card.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'question-actions';
    actions.innerHTML = `<button class="button primary" type="button">Continue</button><span class="enter-note">or press Enter</span>`;
    const next = actions.querySelector('button');
    next.addEventListener('click', () => validateTextQuestion(q, input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && q.type !== 'textarea') {
        e.preventDefault();
        validateTextQuestion(q, input);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && q.type === 'textarea') {
        e.preventDefault();
        validateTextQuestion(q, input);
      }
    });
    card.appendChild(actions);
  }

  card.tabIndex = -1;
  form.appendChild(card);
  window.setTimeout(() => card.focus({ preventScroll: true }), 40);
}

function validateTextQuestion(q, input) {
  const value = input.value.trim();
  input.setCustomValidity('');
  if (q.required && !value) {
    input.setCustomValidity('Please answer this question.');
    input.reportValidity();
    return;
  }
  if (q.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
    input.setCustomValidity('Please enter a valid email address.');
    input.reportValidity();
    return;
  }
  if (q.type === 'url') {
    try {
      const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      new URL(normalized);
      answers[q.id] = normalized;
    } catch {
      input.setCustomValidity('Please enter a valid website or social link.');
      input.reportValidity();
      return;
    }
  } else {
    answers[q.id] = value;
  }
  saveDraft();
  if (q.id === 'email') trackEvent('cg_contact_step_completed', { question_number: questionIndex + 1 });
  nextQuestion();
}

function nextQuestion() {
  if (questionIndex < questions.length - 1) {
    questionIndex += 1;
    renderQuestion();
  } else {
    renderConsent();
  }
}

function renderConsent() {
  updateProgress();
  progress.style.width = '100%';
  stepLabel.textContent = 'Ready for your snapshot';
  form.innerHTML = `
    <div class="question-card">
      <p class="question-kicker">BEFORE YOUR RESULT</p>
      <h2>I’ve got enough to know where I’d start looking.</h2>
      <p class="question-help">I’ll send your answers directly to Laura first. Then your Commercial Growth Snapshot and the audit investment will appear on the next screen.</p>
      <div class="consent-box">
        <label class="consent-row">
          <input type="checkbox" id="lead-consent" />
          <span>I’m happy for Commercial Growth to use these answers and my contact details to respond to this enquiry. This does not subscribe me to marketing. <a href="privacy.html" target="_blank">Privacy notice</a>.</span>
        </label>
      </div>
      <button class="button primary" id="submit-diagnostic" type="button">Show me what you’d investigate</button>
      <p class="submit-status" id="submit-status" role="status"></p>
    </div>`;

  document.getElementById('submit-diagnostic').addEventListener('click', submitLead);
}

function scoreSnapshot() {
  const score = { acquisition: 0, conversion: 0, follow_up: 0, retention: 0, measurement: 0, journey: 0, offer: 0 };
  const challenges = Array.isArray(answers.challenge)
    ? answers.challenge
    : (answers.challenge ? [answers.challenge] : []);
  challenges.forEach((c) => {
    if (c === 'acquisition') score.acquisition += 5;
    if (c === 'conversion') score.conversion += 5;
    if (c === 'follow_up') score.follow_up += 5;
    if (c === 'retention') score.retention += 5;
    if (c === 'journey') score.journey += 5;
    if (c === 'direction') { score.offer += 3; score.measurement += 2; }
    if (c === 'unsure') { score.measurement += 3; score.journey += 2; }
  });

  if (answers.conversion_visibility === 'no') { score.measurement += 4; score.conversion += 2; }
  if (answers.conversion_visibility === 'roughly') { score.measurement += 2; score.conversion += 1; }
  if (answers.follow_up === 'never') score.follow_up += 5;
  if (answers.follow_up === 'rarely') score.follow_up += 4;
  if (answers.follow_up === 'sometimes') score.follow_up += 2;
  if (answers.follow_up === 'unknown') score.measurement += 2;
  if (answers.repeat_potential === 'high') { score.retention += 4; score.offer += 2; }
  if (answers.repeat_potential === 'some') score.retention += 2;
  if (answers.repeat_potential === 'unknown') { score.retention += 1; score.measurement += 1; }
  if (answers.monthly_enquiries === '100+' || answers.monthly_enquiries === '31-100') { score.conversion += 2; score.measurement += 1; }
  if (answers.monthly_enquiries === '0-10' && !challenges.includes('acquisition')) score.acquisition += 2;

  return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key);
}

const areaCopy = {
  acquisition: ['ACQUISITION', 'Lead quality & acquisition efficiency'],
  conversion: ['CONVERSION', 'Enquiry-to-sale conversion'],
  follow_up: ['FOLLOW-UP', 'Lead recovery & follow-up'],
  retention: ['RETENTION', 'Repeat revenue & retention'],
  measurement: ['MEASUREMENT', 'Commercial visibility & baselines'],
  journey: ['CUSTOMER JOURNEY', 'Friction across the buying journey'],
  offer: ['REVENUE', 'Offer structure & revenue expansion']
};

async function submitLead() {
  const consentBox = document.getElementById('lead-consent');
  const status = document.getElementById('submit-status');
  const button = document.getElementById('submit-diagnostic');
  if (!consentBox.checked) {
    status.textContent = 'Please confirm the privacy notice before continuing.';
    status.classList.add('error');
    return;
  }

  const endpoint = (CONFIG.formEndpoint || '').trim();
  if (!endpoint) {
    status.innerHTML = `Lead delivery has not been connected yet. Please email <a href="mailto:${CONFIG.contactEmail || 'lauraqbusiness@gmail.com'}">${CONFIG.contactEmail || 'Laura'}</a> to test the live enquiry flow.`;
    status.classList.add('error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending your answers…';
  status.textContent = '';
  status.classList.remove('error');

  const priorities = scoreSnapshot();
  const payload = {
    ...answers,
    lead_id: leadId,
    stage: 'diagnostic_complete_price_reveal',
    priority_1: areaCopy[priorities[0]][1],
    priority_2: areaCopy[priorities[1]][1],
    priority_3: areaCopy[priorities[2]][1],
    ...attribution,
    page_url: window.location.href,
    submitted_at: new Date().toISOString()
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Submission failed');
    leadSubmitted = true;
    trackEvent('cg_diagnostic_completed', {
      challenge: Array.isArray(answers.challenge) ? answers.challenge.join('|') : answers.challenge,
      monthly_enquiries: answers.monthly_enquiries,
      support_interest: answers.support_interest,
      timeline: answers.timeline,
      heard_from: answers.heard_from
    });
    showSnapshot(priorities);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Try again';
    status.textContent = 'Something did not send properly. Please try again, or contact Laura directly if it keeps happening.';
    status.classList.add('error');
  }
}

function showSnapshot(priorities) {
  form.style.display = 'none';
  backButton.hidden = true;
  stepLabel.textContent = 'Your Commercial Growth Snapshot';
  progress.style.width = '100%';

  const cards = priorities.map((key) => {
    const [label, title] = areaCopy[key];
    return `<article class="snapshot-card"><span>${label}</span><h3>${title}</h3></article>`;
  }).join('');

  const implementationNote = answers.support_interest === 'implementation'
    ? '<p class="price-copy"><strong>You also told me you would be open to implementation support.</strong> If the audit uncovers something worth acting on, ongoing consultancy can be scoped from there.</p>'
    : '';

  const questionSubject = `Commercial Growth question · ${leadId}`;
  const questionBody = `Hi Laura,\n\nI’ve completed the Commercial Growth Check and I have a question before deciding on the Audit.\n\n`;
  const gmailQuestionUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONFIG.contactEmail || 'lauraqbusiness@gmail.com')}&su=${encodeURIComponent(questionSubject)}&body=${encodeURIComponent(questionBody)}`;

  snapshotStage.innerHTML = `
    <div class="snapshot-top">
      <p class="eyebrow">YOUR COMMERCIAL GROWTH SNAPSHOT</p>
      <h2>${answers.name ? `${answers.name}, ` : ''}these are the areas I would investigate first.</h2>
      <p class="snapshot-disclaimer">This is not a diagnosis and I am not claiming anything is wrong with the business from a short form. Your answers simply tell me where the strongest commercial questions are likely to be.</p>
    </div>
    <div class="snapshot-grid">${cards}</div>
    <div class="price-reveal">
      <p class="small-label">RECOMMENDED NEXT STEP</p>
      <h3>Commercial Growth Audit</h3>
      <p class="price-copy">A deeper review of the customer journey, sales process, conversion, follow-up, retention, offers and commercial performance signals, followed by prioritised findings and a practical action plan.</p>
      <div class="price-row">
        <span class="price-current">${CONFIG.auditLaunchPrice || '€349'}</span>
        <span class="price-standard">Founding client rate · standard rate <s>${CONFIG.auditStandardPrice || '€495'}</s></span>
      </div>
      ${implementationNote}
      <div class="snapshot-actions">
        <button class="button primary" id="request-audit" type="button">Request my Audit</button>
        <a class="button secondary" id="ask-question" href="${gmailQuestionUrl}" target="_blank" rel="noopener noreferrer">I have a question first</a>
      </div>
      <div id="intent-confirmation"></div>
    </div>`;
  snapshotStage.classList.add('active');
  trackEvent('cg_price_viewed', { audit_price: (CONFIG.auditLaunchPrice || '349').replace(/\D/g, '') });

  document.getElementById('request-audit').addEventListener('click', requestAudit);
  document.getElementById('ask-question').addEventListener('click', () => trackEvent('cg_question_clicked'));
}

async function requestAudit() {
  const button = document.getElementById('request-audit');
  const box = document.getElementById('intent-confirmation');
  const endpoint = (CONFIG.formEndpoint || '').trim();
  button.disabled = true;
  button.textContent = 'Sending…';

  try {
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          stage: 'audit_requested',
          name: answers.name,
          business: answers.business,
          email: answers.email,
          support_interest: answers.support_interest,
          timeline: answers.timeline,
          submitted_at: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Intent failed');
    }
    trackEvent('cg_audit_requested', { support_interest: answers.support_interest, timeline: answers.timeline });
    box.className = 'intent-confirmation';
    box.innerHTML = '<strong>Your Audit request is in.</strong><span>Laura already has your Commercial Growth Check answers and will come back to you about the best next step.</span>';
    button.textContent = 'Audit requested ✓';
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Request my Audit';
    box.className = 'intent-confirmation';
    box.innerHTML = `Something did not send properly. Please email <a href="mailto:${CONFIG.contactEmail || 'lauraqbusiness@gmail.com'}?subject=${encodeURIComponent(`Commercial Growth Audit · ${leadId}`)}">Laura directly</a>.`;
  }
}
