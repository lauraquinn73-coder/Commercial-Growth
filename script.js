// Commercial Growth V1.4 - Tally enquiry handoff and local-only Check snapshot
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

// Editorial V1.3: interactive customer journey and mobile navigation.
const journeyObservations = {
  interest: { label: '01 / INTEREST', copy: 'Can the right people immediately understand what you offer and why it matters to them?' },
  enquiry: { label: '02 / ENQUIRY', copy: 'Is it easy to enquire, and does every lead get a clear next step?' },
  sale: { label: '03 / SALE', copy: 'What slows a decision between initial interest, a quote and a confirmed sale?' },
  return: { label: '04 / RETURN', copy: 'What makes a customer come back, and do you make that next step easy?' }
};
const journeyNodes = Array.from(document.querySelectorAll('[data-journey]'));
const journeyLabel = document.getElementById('journey-insight-label');
const journeyCopy = document.getElementById('journey-insight-copy');
journeyNodes.forEach((node) => {
  node.addEventListener('click', () => {
    const selected = journeyObservations[node.dataset.journey];
    if (!selected || !journeyLabel || !journeyCopy) return;
    journeyNodes.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === node)));
    journeyLabel.textContent = selected.label;
    journeyCopy.textContent = selected.copy;
    trackEvent('cg_journey_stage_selected', { stage: node.dataset.journey });
  });
});
const navMenuButton = document.getElementById('nav-menu-toggle');
const navLinks = document.getElementById('primary-nav-links');
function closeMobileNav() {
  navMenuButton?.setAttribute('aria-expanded', 'false');
  navMenuButton?.setAttribute('aria-label', 'Open navigation menu');
  navLinks?.classList.remove('is-open');
}
navMenuButton?.addEventListener('click', () => {
  const open = navMenuButton.getAttribute('aria-expanded') !== 'true';
  navMenuButton.setAttribute('aria-expanded', String(open));
  navMenuButton.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  navLinks?.classList.toggle('is-open', open);
});
navLinks?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileNav));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navMenuButton?.getAttribute('aria-expanded') === 'true') {
    closeMobileNav();
    navMenuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (navMenuButton?.getAttribute('aria-expanded') === 'true' && !event.target.closest('.primary-nav')) closeMobileNav();
});
window.matchMedia('(min-width: 981px)').addEventListener('change', (event) => { if (event.matches) closeMobileNav(); });

// Remove any lead identifier left in session storage by pre-V1.4 site versions.
try { sessionStorage.removeItem('cg_lead_id'); } catch (_) {}

// The free Check produces an on-device snapshot. No person-specific details,
// free-text answers or identifying lead reference are sent to Tally by the site.
// Tally receives only a short category code when a visitor clicks an enquiry link.
function tallyUrl(requestType = 'general', priorities = []) {
  const fallback = 'https://tally.so/r/WOGzKv';
  const base = String(CONFIG.tallyFormUrl || fallback).trim();
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.hostname !== 'tally.so' || !/^\/r\/[a-zA-Z0-9]+$/.test(url.pathname)) {
      return fallback;
    }
    url.searchParams.set('cg_source', requestType === 'audit' ? 'audit' : 'website');
    const codes = priorities.filter((item) => Object.hasOwn(areaCopy, item)).slice(0, 3);
    if (codes.length) url.searchParams.set('cg_focus', codes.join(','));
    return url.toString();
  } catch (_) {
    return fallback;
  }
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

let priceViewed = false;
let auditCtaClicked = false;

// Consent-aware GA4. Google Analytics is completely disabled until a valid
// Measurement ID exists AND the visitor explicitly opts in. No name, email,
// business name, URL supplied in the Check, free-text answer or internal lead ID
// is sent to GA4.
let analyticsReady = false;
const analyticsId = (CONFIG.gaMeasurementId || '').trim();
const analyticsConfigured = /^G-[A-Z0-9]+$/i.test(analyticsId);

function loadAnalytics() {
  if (!analyticsConfigured || analyticsReady) return;
  window[`ga-disable-${analyticsId}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', analyticsId, {
    send_page_view: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 90 * 24 * 60 * 60,
    cookie_update: false
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
  document.head.appendChild(script);
  analyticsReady = true;
}

function deleteAnalyticsCookies() {
  const names = document.cookie.split(';').map((part) => part.split('=')[0].trim()).filter((name) => name === '_ga' || name.startsWith('_ga_'));
  const domains = [window.location.hostname, `.${window.location.hostname}`];
  names.forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
    });
  });
}

function disableAnalytics() {
  if (analyticsConfigured) window[`ga-disable-${analyticsId}`] = true;
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  analyticsReady = false;
  deleteAnalyticsCookies();
}

function trackEvent(name, details = {}) {
  if (!analyticsReady || typeof window.gtag !== 'function') return;
  // Event details must stay categorical/aggregate. Never add PII or free-text here.
  window.gtag('event', name, details);
}
// Exposes only categorical event reporting. Never pass a website URL or answer here.
window.CG_trackEvent = trackEvent;

const cookieBanner = document.getElementById('cookie-banner');
const privacyChoicesButton = document.getElementById('privacy-choices');
const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function readStoredConsent() {
  const raw = localStorage.getItem('cg_analytics_consent');
  if (!raw) return null;
  if (raw === 'yes' || raw === 'no') {
    // Migrate older versions and ask again rather than treating an undated choice as permanent.
    localStorage.removeItem('cg_analytics_consent');
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !['yes', 'no'].includes(parsed.choice) || !parsed.savedAt) return null;
    if (Date.now() - Number(parsed.savedAt) > CONSENT_MAX_AGE_MS) {
      localStorage.removeItem('cg_analytics_consent');
      return null;
    }
    return parsed.choice;
  } catch (_) {
    localStorage.removeItem('cg_analytics_consent');
    return null;
  }
}

function storeConsent(choice) {
  localStorage.setItem('cg_analytics_consent', JSON.stringify({ choice, savedAt: Date.now() }));
}

const storedConsent = readStoredConsent();

function showPrivacyChoices() {
  if (!cookieBanner || !analyticsConfigured) return;
  cookieBanner.hidden = false;
}
function hidePrivacyChoices() {
  if (cookieBanner) cookieBanner.hidden = true;
}

// Do not show a meaningless analytics banner before GA4 has actually been connected.
if (analyticsConfigured) {
  if (storedConsent === 'yes') loadAnalytics();
  if (!storedConsent) showPrivacyChoices();
} else {
  hidePrivacyChoices();
}

// Visitors coming from any legal page can manage their existing choice.
if (analyticsConfigured && new URLSearchParams(location.search).get('privacy') === 'manage') {
  showPrivacyChoices();
}

privacyChoicesButton?.addEventListener('click', () => {
  if (!analyticsConfigured) return;
  showPrivacyChoices();
});

document.getElementById('cookie-allow')?.addEventListener('click', () => {
  storeConsent('yes');
  hidePrivacyChoices();
  loadAnalytics();
  trackEvent('cg_analytics_consent', { choice: 'accepted' });
});

document.getElementById('cookie-essential')?.addEventListener('click', () => {
  storeConsent('no');
  disableAnalytics();
  hidePrivacyChoices();
});

// No visitor answers or sensitive business notes are ever placed in a URL.
// The optional copy action is triggered separately by the visitor.
function openEmailDraft(subject) {
  const to=CONFIG.contactEmail||'lauraqbusiness@gmail.com';
  const href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
  const link=document.createElement('a');link.href=href;link.style.display='none';
  document.body.append(link);link.click();link.remove();
}
async function copyPrivateSummary(value){
  try {await navigator.clipboard.writeText(value);return true;}
  catch {return false;}
}

const generalEmailSubject = 'Commercial Growth enquiry';
const generalEmailBody = `Hi Laura,\n\nI came across Commercial Growth and wanted to get in touch about my business.\n\nMy business is:\n\nI’d like to ask about:\n\nThanks,`;

// Track lower-friction contact intent without collecting any personal data in analytics.
document.getElementById('contact-enquiry')?.addEventListener('click', () => {
  trackEvent('cg_enquiry_link_clicked', { placement: 'contact_section' });
});

document.getElementById('contact-instagram')?.addEventListener('click', () => {
  trackEvent('cg_instagram_clicked', { placement: 'contact_section' });
});
document.getElementById('footer-email')?.addEventListener('click', () => {
  trackEvent('cg_email_clicked', { placement: 'footer' });
  // Keep the native mailto: link so visitors can use Outlook, Apple Mail or
  // whichever email service they prefer instead of forcing Gmail.
});

const questions = [
  {
    id: 'offer',
    title: 'What does the business actually sell?',
    help: 'A sentence or two is enough. Do not include customer names, staff details, health information or other sensitive personal data.',
    type: 'textarea',
    placeholder: 'We sell…',
    required: true
  },
  {
    id: 'business_url',
    title: 'Where can I take a look at the business?',
    help: 'Optional. Website, Instagram or another public business link.',
    type: 'url',
    placeholder: 'https://…',
    required: false
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
      ['0-10', '0 to 10'],
      ['11-30', '11 to 30'],
      ['31-100', '31 to 100'],
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
      ['month', 'Within 1 to 3 months'],
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
      ['other', 'Somewhere else'],
      ['prefer_not', 'Prefer not to say']
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
let answers = {};
try {
  const draft = JSON.parse(sessionStorage.getItem('cg_check_answers') || '{}');
  if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
    const allowed = new Set(questions.map((item) => item.id));
    answers = Object.fromEntries(Object.entries(draft).filter(([key]) => allowed.has(key)));
  }
  sessionStorage.setItem('cg_check_answers', JSON.stringify(answers));
} catch (_) {
  answers = {};
  try { sessionStorage.removeItem('cg_check_answers'); } catch (_) {}
}
let snapshotShown = false;
// Temporary memory-only handoff from a scan; not stored in analytics or sent to us.
window.CG_prefillBusinessUrl = function(url) {
  try {
    const u=new URL(url);
    if(u.protocol!=='https:' || u.search || u.hash || u.username || u.password) return;
    answers.business_url=u.origin+'/';
    saveDraft();
  } catch (_) {}
};
let previouslyFocusedElement = null;

function getFocusableElements(container) {
  return [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
}

function saveDraft() {
  sessionStorage.setItem('cg_check_answers', JSON.stringify(answers));
}

// The sample answer on the homepage is a real answer to the matching
// follow-up question later in the Growth Check, not a pretend lead submission.
const previewInsights = {
  always: 'That is a useful foundation. I would look at the consistency, timing and effectiveness of the follow-up, not just whether it happens.',
  sometimes: 'There may be opportunities sitting between first interest and a decision. I would investigate where follow-up becomes inconsistent.',
  rarely: 'When the next step depends on the person handling an enquiry, the customer experience can vary. I would examine the handover and follow-up process.',
  unknown: 'Before recommending anything, I would establish what actually happens after an enquiry and whether the business can measure it.'
};

document.querySelectorAll('.preview-choice').forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.followUp;
    const insight = previewInsights[value];
    if (!insight) return;
    answers.follow_up = value;
    saveDraft();
    document.querySelectorAll('.preview-choice').forEach((option) => {
      const active = option === button;
      option.classList.toggle('selected', active);
      option.setAttribute('aria-pressed', String(active));
    });
    const insightContainer = document.getElementById('preview-insight');
    document.getElementById('preview-insight-text').textContent = insight;
    insightContainer.hidden = false;
    document.getElementById('preview-hint').hidden = true;
    trackEvent('cg_preview_answer_selected', { answer_category: value });
  });
});
document.getElementById('preview-next')?.addEventListener('click', () => {
  trackEvent('cg_preview_to_check');
  openCheck();
});

function openCheck() {
  previouslyFocusedElement = document.activeElement;
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
  window.setTimeout(() => {
    const focusables = getFocusableElements(modal);
    (focusables[0] || document.getElementById('check-close'))?.focus({ preventScroll: true });
  }, 30);
}
function closeCheck() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('check-open');
  if (questionIndex >= 0 && !snapshotShown) {
    trackEvent('cg_check_closed', { question_number: questionIndex + 1 });
  } else if (snapshotShown && priceViewed && !auditCtaClicked) {
    trackEvent('cg_price_abandoned', { stage: 'price_viewed_no_request' });
  }
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    previouslyFocusedElement.focus({ preventScroll: true });
  }
}

window.CG_openCheck = openCheck;
document.querySelectorAll('.js-open-check').forEach((button) => button.addEventListener('click', openCheck));
document.getElementById('check-close')?.addEventListener('click', closeCheck);
modal?.addEventListener('click', (e) => { if (e.target === modal) closeCheck(); });
document.addEventListener('keydown', (e) => {
  if (!modal?.classList.contains('open')) return;
  if (e.key === 'Escape') {
    closeCheck();
    return;
  }
  if (e.key === 'Tab') {
    const focusables = getFocusableElements(modal);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

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
  trackEvent('cg_check_question_viewed', { question_number: questionIndex + 1, question_id: q.id });
  updateProgress();
  backButton.hidden = questionIndex <= 0;
  form.innerHTML = '';
  const checkBody = document.getElementById('check-body');
  if (checkBody) checkBody.scrollTop = 0;

  const card = document.createElement('div');
  card.className = 'question-card';
  const titleId = `question-title-${q.id}`;
  const helpId = q.help ? `question-help-${q.id}` : '';
  card.innerHTML = `<div class="question-copy"><p class="question-kicker">Question ${questionIndex + 1}</p><h2 id="${titleId}" tabindex="-1">${q.title}</h2>${q.help ? `<p class="question-help" id="${helpId}">${q.help}</p>` : ''}</div>`;

  if (q.type === 'choice') {
    const grid = document.createElement('div');
    grid.className = 'option-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-labelledby', titleId);
    if (helpId) grid.setAttribute('aria-describedby', helpId);

    const actions = document.createElement('div');
    actions.className = 'multi-actions';
    const hint = document.createElement('span');
    hint.className = 'selection-count';
    hint.textContent = 'Choose one option';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'button primary multi-continue';
    next.textContent = 'Continue';
    next.disabled = !answers[q.id];

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
        next.disabled = false;
      });
      grid.appendChild(btn);
    });
    next.addEventListener('click', () => { if (answers[q.id]) nextQuestion(); });
    actions.appendChild(hint);
    actions.appendChild(next);
    card.appendChild(grid);
    card.appendChild(actions);
  } else if (q.type === 'multi') {
    const selected = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [];
    answers[q.id] = selected;

    const grid = document.createElement('div');
    grid.className = 'option-grid multi-option-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-labelledby', titleId);
    if (helpId) grid.setAttribute('aria-describedby', helpId);

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
    input.required = Boolean(q.required);
    input.setAttribute('aria-required', q.required ? 'true' : 'false');
    const maxLengths = { name: 80, business: 120, offer: 500, business_url: 300, email: 254 };
    if (maxLengths[q.id]) input.maxLength = maxLengths[q.id];
    input.setAttribute('aria-labelledby', titleId);
    if (helpId) input.setAttribute('aria-describedby', helpId);
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

  form.appendChild(card);
  window.setTimeout(() => document.getElementById(titleId)?.focus({ preventScroll: true }), 40);
}

function validateTextQuestion(q, input) {
  const value = input.value.trim();
  input.setCustomValidity('');
  if (q.required && !value) {
    input.setCustomValidity('Please answer this question.');
    input.reportValidity();
    return;
  }
  if (!value && !q.required) {
    answers[q.id] = '';
    saveDraft();
    nextQuestion();
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
  nextQuestion();
}

function nextQuestion() {
  trackEvent('cg_check_step_completed',{question_number: questionIndex+1, question_id:questions[questionIndex]?.id});
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
      <p class="question-kicker">YOUR FREE SNAPSHOT</p>
      <h2 id="consent-title" tabindex="-1">I’ve got enough to know where I’d start looking.</h2>
      <p class="question-help">Your answers are used in this browser to generate a preliminary Growth Snapshot. They are not sent to Commercial Growth. If you'd like Laura to review your business, you can choose to send a separate enquiry through Tally afterwards.</p>
      <p class="question-help">Please don't enter sensitive personal information or confidential customer records into the Check.</p>
      <button class="button primary" id="submit-diagnostic" type="button">Show my Growth Snapshot</button>
    </div>`;
  document.getElementById('submit-diagnostic').addEventListener('click', showLocalSnapshot);
  window.setTimeout(() => document.getElementById('consent-title')?.focus({ preventScroll: true }), 30);
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

function buildSnapshotReason(priorities) {
  const snippets = [];
  if (answers.monthly_enquiries === '31-100' || answers.monthly_enquiries === '100+') {
    snippets.push('you already have meaningful enquiry volume');
  } else if (answers.monthly_enquiries === '11-30') {
    snippets.push('there is enough enquiry activity to start looking for patterns');
  }
  if (answers.conversion_visibility === 'no') snippets.push('conversion is not currently being measured clearly');
  if (answers.conversion_visibility === 'roughly') snippets.push('conversion visibility is still approximate');
  if (answers.follow_up === 'never' || answers.follow_up === 'rarely') snippets.push('follow-up appears to be a potential recovery point');
  if (answers.follow_up === 'sometimes') snippets.push('follow-up is not yet fully consistent');
  if (answers.repeat_potential === 'high') snippets.push('there is strong repeat or additional-sale potential');
  if (answers.repeat_potential === 'some') snippets.push('there is some repeat-revenue potential worth testing');
  if (answers.support_interest === 'implementation') snippets.push('you are open to acting on what the audit finds');

  if (!snippets.length) {
    const labels = priorities.slice(0,2).map((key) => areaCopy[key][0].toLowerCase());
    return `Your answers point me first toward ${labels.join(' and ')}. The purpose of the Audit would be to establish what is actually happening before recommending a fix.`;
  }

  const selected = snippets.slice(0, 3);
  const sentence = selected.length === 1
    ? selected[0]
    : `${selected.slice(0,-1).join(', ')} and ${selected[selected.length-1]}`;
  return `These areas surfaced because ${sentence}. That combination is where I would start testing for commercial leakage or missed opportunity.`;
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

function showLocalSnapshot() {
  const priorities = scoreSnapshot();
  snapshotShown = true;
  trackEvent('cg_diagnostic_completed', {
    challenge: Array.isArray(answers.challenge) ? answers.challenge.join('|') : answers.challenge,
    monthly_enquiries: answers.monthly_enquiries,
    support_interest: answers.support_interest,
    timeline: answers.timeline,
    heard_from: answers.heard_from
  });
  showAnalysis(priorities);
}

function showAnalysis(priorities) {
  form.style.display = 'none';
  backButton.hidden = true;
  stepLabel.textContent = 'Analysing your responses';
  progress.style.width = '100%';
  snapshotStage.classList.add('active');
  trackEvent('cg_analysis_started', { stage: 'post_diagnostic' });

  snapshotStage.innerHTML = `
    <div class="analysis-stage" role="status" aria-live="polite">
      <p class="eyebrow">COMMERCIAL GROWTH CHECK</p>
      <div class="analysis-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <h2>Analysing your responses…</h2>
      <p class="analysis-lead">I’m comparing the signals across demand, conversion, follow-up, repeat revenue and the customer journey to prioritise where I would look first.</p>
      <div class="analysis-list" aria-hidden="true">
        <div class="analysis-item active"><span>01</span><p>Reviewing demand & conversion signals</p></div>
        <div class="analysis-item"><span>02</span><p>Checking follow-up & retention potential</p></div>
        <div class="analysis-item"><span>03</span><p>Prioritising the strongest commercial questions</p></div>
      </div>
      <p class="analysis-note">This is based on what you told me, not a generic scorecard.</p>
    </div>`;

  const items = [...snapshotStage.querySelectorAll('.analysis-item')];
  window.setTimeout(() => { items[0]?.classList.add('done'); items[1]?.classList.add('active'); }, 650);
  window.setTimeout(() => { items[1]?.classList.add('done'); items[2]?.classList.add('active'); }, 1300);
  window.setTimeout(() => { items[2]?.classList.add('done'); showSnapshot(priorities); }, 2100);
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

  const tailoredReason = buildSnapshotReason(priorities);
  const implementationNote = answers.support_interest === 'implementation'
    ? '<p class="price-copy"><strong>You also told me you would be open to implementation support.</strong> If the audit uncovers something worth acting on, ongoing consultancy can be scoped from there.</p>'
    : '';

  const questionSubject = 'Question about Commercial Growth';
  const questionBody = 'Hi Laura,\n\nI’ve completed the Commercial Growth Check and I have a question before deciding on the Audit.\n\nMy question is:\n\n\nThanks,';

  snapshotStage.innerHTML = `
    <div class="snapshot-top">
      <p class="eyebrow">YOUR COMMERCIAL GROWTH SNAPSHOT</p>
      <h2 id="snapshot-title" tabindex="-1">Here’s where I would start.</h2>
      <p class="snapshot-intro">Your answers have been compared across the commercial journey to surface the areas most worth investigating first. This snapshot stays in your browser and hasn't been sent to Laura.</p>
      <div class="snapshot-rationale"><span>WHY THESE AREAS SURFACED</span><p>${escapeHTML(tailoredReason)}</p></div>
      <p class="snapshot-disclaimer">This is an initial commercial snapshot, not a diagnosis. I would validate the causes against the real customer journey, process and performance data before recommending changes.</p>
    </div>
    <div class="snapshot-grid">${cards}</div>
    <div class="price-reveal">
      <p class="small-label">RECOMMENDED NEXT STEP</p>
      <h3>Commercial Growth Audit</h3>
      <p class="price-copy">A deeper review of the customer journey, sales process, conversion, follow-up, retention, offers and commercial performance signals, followed by prioritised findings and a practical action plan.</p>
      <div class="audit-value-strip">
        <span><strong>Diagnose</strong> what is actually happening</span>
        <span><strong>Prioritise</strong> what is worth fixing first</span>
        <span><strong>Implement</strong> support is available if needed</span>
      </div>
      <div class="price-row">
        <span class="price-current">${CONFIG.auditLaunchPrice || '€349'}</span>
        <span class="price-standard">Founding-client rate</span>
      </div>
      ${implementationNote}
      <p class="request-note">Enquiries open a separate Tally form. Your Check answers are not submitted automatically; to share detail, add a short note in the enquiry form. No payment is taken and no contract is created. <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> · <a href="refunds.html" target="_blank" rel="noopener noreferrer">Refund policy</a>.</p>
      <div class="snapshot-actions">
        <a class="button primary" id="request-audit" href="${tallyUrl('audit', priorities)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Enquire about an Audit ↗</a>
        <button class="button secondary" id="ask-question" type="button">I have a question first</button>
      </div>
      <section class="share-snapshot" aria-label="Share your Growth Check findings">
        <h3>Want me to see what you've found?</h3>
        <p>Your answers remain on your device unless you choose to share them. You can send me your snapshot directly without filling out the Check again.</p>
        <button class="button secondary" id="share-by-email" type="button">Copy my summary to share by email</button>
        <div id="direct-share-area" hidden></div>
      </section>
      <button class="retake-check" id="retake-check" type="button">Start a fresh Check</button>
      <div id="intent-confirmation"></div>
    </div>`;
  snapshotStage.classList.add('active');
  priceViewed = true;
  window.setTimeout(() => document.getElementById('snapshot-title')?.focus({ preventScroll: true }), 30);
  trackEvent('cg_snapshot_viewed', { priority_count: priorities.length });
  trackEvent('cg_price_viewed', { audit_price: (CONFIG.auditLaunchPrice || '349').replace(/\D/g, '') });

  document.getElementById('share-by-email')?.addEventListener('click',async()=>{
    const summary=questions.map(q=>{
      const raw=answers[q.id];
      const value=Array.isArray(raw)?raw.join(', '):String(raw||'(not provided)');
      return q.title+'\n'+value;
    }).join('\n\n');
    const text='Priority areas: '+priorities.join(', ')+'\n\n'+summary;
    const copied=await copyPrivateSummary(text);
    const button=document.getElementById('share-by-email');
    if(copied){
      button.textContent='Copied — open your email and paste the summary';
      trackEvent('cg_snapshot_summary_copied');
      // Only a generic subject and recipient go to the visitor's email app.
      openEmailDraft('Commercial Growth Check enquiry');
    } else {
      button.textContent='Clipboard unavailable — use your own email, or the direct-share form';
    }
  });
  enableDirectShare(priorities);
  document.getElementById('request-audit').addEventListener('click', () => {
    auditCtaClicked = true;
    trackEvent('cg_audit_enquiry_link_clicked', { placement: 'snapshot' });
  });
  document.getElementById('ask-question').addEventListener('click', (event) => {
    event.preventDefault();
    trackEvent('cg_question_clicked');
    openEmailDraft(questionSubject);
  });
  document.getElementById('retake-check')?.addEventListener('click', () => {
    answers = {};
    sessionStorage.removeItem('cg_check_answers');
    snapshotShown = false;
    priceViewed = false;
    auditCtaClicked = false;
    questionIndex = 0;
    snapshotStage.classList.remove('active');
    snapshotStage.innerHTML = '';
    form.style.display = '';
    backButton.hidden = true;
    renderQuestion();
    trackEvent('cg_check_restarted');
  });
}


// Secure, optional D1 lead submission. If the private Worker database is not
// configured, the email handoff above still works and no form is displayed.
async function enableDirectShare(priorities) {
  const area=document.getElementById('direct-share-area');
  if(!area) return;
  const cfg=window.CG_CONFIG||{};
  const endpoint=String(cfg.scannerEndpoint||'').trim().replace(/\/$/,'');
  const key=String(cfg.turnstileSiteKey||'').trim();
  if(!endpoint || !key) return;
  const local=['localhost','127.0.0.1'].includes(location.hostname) && location.port==='8000' && endpoint==='http://127.0.0.1:8787';
  const production=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(endpoint) && /^[a-z0-9_-]{12,}$/i.test(key);
  if(!local && !production) return;
  try {
    const capability=await fetch(endpoint+'/capabilities',{credentials:'omit',referrerPolicy:'no-referrer'});
    const data=await capability.json();
    if(!capability.ok || !data.leadSharing || !area.isConnected) return;
  } catch {return;}
  area.hidden=false;
  area.innerHTML=`<form class="share-form" id="share-check-form" novalidate>
    <h4>Share privately with Commercial Growth</h4>
    <p class="question-help">Only send business information you are authorised to share. Laura will receive your answers, website link (if provided), focus areas and contact details. No marketing subscription.</p>
    <label for="share-name">Your name</label><input id="share-name" name="name" autocomplete="name" maxlength="80" required />
    <label for="share-business">Business name</label><input id="share-business" name="business" maxlength="120" autocomplete="organization" required />
    <label for="share-email">Email address</label><input id="share-email" type="email" name="email" maxlength="254" autocomplete="email" required />
    <label class="share-consent"><input id="share-approval" type="checkbox" required /> <span>I am authorised to share these details and choose to send my contact details and Growth Check answers to Commercial Growth for a personal response, as explained in the <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
    <div id="share-turnstile"></div>
    <button class="button primary" id="share-submit" type="submit">Send my findings securely →</button>
    <div id="share-feedback" role="status" aria-live="polite"></div>
  </form>`;
  const form=area.querySelector('form');
  const feedback=area.querySelector('#share-feedback');
  let token='',widget=null;
  if(production) {
    // Re-use Turnstile script loaded by the scanner, if present.
    async function loadWidget() {
      if(!window.turnstile) {
        const existing=document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
        if(!existing) {
          const script=document.createElement('script');
          script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async=true;
          document.head.append(script);
        }
        for(let i=0;i<40 && !window.turnstile;i++) await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(window.turnstile && area.isConnected) {
        widget=window.turnstile.render(area.querySelector('#share-turnstile'),{
          sitekey:key,action:'cg_lead',theme:'light',size:'flexible',appearance:'interaction-only',
          callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';}
        });
      } else feedback.textContent='Verification is unavailable. You can share your findings by email instead.';
    }
    loadWidget();
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity()) return;
    if(production && !token) {feedback.textContent='Please complete the security verification first.';return;}
    const button=area.querySelector('#share-submit');
    button.disabled=true;
    feedback.textContent='Sending your findings securely…';
    try {
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),20000);
      let response;
      try {
        response=await fetch(endpoint+'/lead',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',
          headers:{'Content-Type':'application/json'},signal:controller.signal,
          body:JSON.stringify({name:form.elements.name.value,business:form.elements.business.value,email:form.elements.email.value,
            answers,priorities,shareConsent:form.querySelector('#share-approval').checked,privacyVersion:'2026-10-11-v17-privacy2',
            ...(production?{turnstileToken:token}:{})})});
      } finally {clearTimeout(timeout);}
      const data=await response.json();
      if(!response.ok || data.ok!==true) throw new Error(data.error||'The submission could not be completed.');
      feedback.replaceChildren();
      const message=document.createElement('p');message.textContent='Your findings were submitted. Keep this private deletion code to withdraw the submitted record. Anyone with the code can delete it.';
      const code=document.createElement('code');code.textContent=data.withdrawalCode||'';code.style.overflowWrap='anywhere';
      const copy=document.createElement('button');copy.type='button';copy.className='button secondary';copy.textContent='Copy deletion code';
      copy.addEventListener('click',async()=>{copy.textContent=await copyPrivateSummary(data.withdrawalCode)?'Code copied':'Please select and copy the code';});
      const erase=document.createElement('button');erase.type='button';erase.className='button secondary';erase.textContent='Delete my submitted findings';
      erase.addEventListener('click',async()=>{
        erase.disabled=true;
        try{
          const r=await fetch(endpoint+'/withdraw',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:data.withdrawalCode})});
          if(!r.ok) throw Error('Deletion unavailable. Use your code in our Privacy Policy deletion form.');
          message.textContent='Deletion request processed. Your submitted findings have been removed from the database.';
          code.remove();copy.remove();erase.remove();
        }catch(error){message.textContent=error.message;erase.disabled=false;}
      });
      feedback.append(message,code,copy,erase);
      form.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      trackEvent('cg_snapshot_shared',{method:'direct'});
      try {sessionStorage.removeItem('cg_check_answers');}catch(_){}
    } catch (error) {
      feedback.textContent=error?.message||'Submission unavailable. You can use the email option instead.';
      button.disabled=false;
      if(widget!==null && window.turnstile) {try{window.turnstile.reset(widget);}catch{}}
      token='';
    }
  });
}
