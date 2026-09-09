# Commercial Growth V11 — legal, privacy, accessibility and launch hardening

This build includes the V10 acquisition funnel plus a legal/privacy/accessibility hardening pass for `commercialgrowth.ie`.

## Included in this build
- Commercial Growth Check and Formspree lead delivery.
- GA4 `G-5PNH8XMW8N`, blocked until the visitor actively allows analytics.
- Analytics withdrawal now disables further tracking and attempts to remove first-party GA cookies.
- Analytics consent expires after no more than six months so the visitor is asked again.
- GA cookies are configured for a maximum 90-day expiry with no rolling renewal.
- UTM/source attribution is kept in page memory only and attached to a lead only when the Check is submitted; it is not written to browser storage.
- Free-text and URL fields have length limits and the public business link is optional.
- The Check warns users not to provide sensitive personal data or confidential customer/staff information.
- Required privacy acknowledgement before submitting the Check.
- Honeypot field for basic bot resistance.
- Keyboard-accessible modal with focus trapping and focus restoration.
- Text inputs are programmatically associated with their question headings.
- Single-choice questions now require an explicit Continue action instead of unexpected auto-advance.
- Minimum interactive target sizes preserved at approximately 44px on mobile.
- Contrast-safe darker accent for small text and focus states.
- Third-party Google Fonts removed; the site now uses local/system font stacks.
- No embedded social feeds, videos, maps or advertising pixels.
- Legal pages added: Privacy, Cookies, Terms, Refunds, Accessibility.
- Footer legal links and business-operator disclosure added.
- Claims softened to avoid presenting the free Check as a diagnosis or promising outcomes.

## Legal pages
- `privacy.html`
- `cookies.html`
- `terms.html`
- `refunds.html`
- `accessibility.html`

These pages are practical website policies, not a substitute for an Irish solicitor reviewing your final client engagement agreement.

## Owner actions still required outside the code

### 1. Geographic business/service address
Irish e-commerce rules can require a service provider to make its geographic establishment address easily and permanently accessible. This build does **not** invent or publish a residential address. Before relying on the website commercially, establish a genuine non-residential business/service address that you are legally entitled to use, then add it to the Terms/business details and other required pre-contract information.

### 2. Business-name registration
If carrying on business in Ireland as `Commercial Growth`, register the business name with the CRO when required. Add the registration number/details to the site once issued.

### 3. Formspree account settings
In Formspree:
- enable **Restrict to Domain** for `commercialgrowth.ie`;
- review/accept the processor/DPA terms available to your account;
- regularly delete old test and enquiry submissions in line with the retention policy;
- optionally enable Cloudflare Turnstile if spam becomes a problem.

### 4. Google Analytics settings
For privacy minimisation, review the Commercial Growth GA4 property and:
- keep Google Signals / advertising personalisation disabled;
- set user/event data retention to the shortest useful period (for example 2 months);
- consider disabling granular location/device collection where you do not need it;
- disable Enhanced Measurement **Form interactions** because the site already has purpose-built funnel events and does not need Google to auto-detect form activity;
- do not link Google Ads unless the cookie/privacy setup is reviewed again first.

### 5. Client engagement agreement
Before accepting paid work, use a separate written engagement agreement covering scope, fees, payment schedule, confidentiality, client responsibilities, intellectual property, cancellation/refunds, limitation of liability, no guaranteed commercial result, termination and governing law. Website Terms alone should not be used as the consultancy contract.

### 6. If online checkout is added later
Do not add online payment or one-click contracting without another legal review. Consumer-facing distance-contract rules can require extra trader details, telephone/contact information, cancellation information and durable-medium confirmation. The current site deliberately does not take payment or conclude a contract online.

## Deployment
1. Extract the ZIP.
2. Upload the individual files inside this folder to the **root** of the Commercial Growth GitHub repository.
3. Keep `CNAME` in the root.
4. Commit the changes.
5. Test in a private/incognito browser on mobile and desktop.

## Launch QA
- Reject analytics and confirm no `_ga` cookies appear.
- Allow analytics and confirm Realtime receives a test visit.
- Reopen Privacy choices and reject analytics; confirm tracking stops and GA cookies are removed where the browser permits.
- Complete a fresh Commercial Growth Check and confirm the Formspree submission arrives.
- Test all legal-page links.
- Complete the Check using keyboard only (Tab, Shift+Tab, Enter/Space, Escape).
- Zoom browser text to 200% and check that content remains readable and operable.
- Test with reduced-motion enabled if available.
- Confirm no personal location/address appears anywhere until a compliant business service address is intentionally added.


## V12 updates
- Replaced the top-bar “Take the Check” CTA with the warmer “Find the gaps”.
- Added an in-app-browser-safe email handoff: Instagram/TikTok/Facebook open a pre-addressed Gmail draft; normal mobile browsers use the device mail composer; desktop opens Gmail compose.
- Email links use a Gmail HTTPS fallback so a blocked mailto link does not produce “link cannot be loaded”.
