# Commercial Growth acquisition-ready website

Static GitHub Pages site for `commercialgrowth.ie` with a built-in Commercial Growth Check and acquisition attribution.

## What changed
- Primary CTA is now the **Commercial Growth Check**, not a generic contact button.
- One-question-at-a-time diagnostic flow.
- Lead details are submitted **before pricing is revealed**.
- The visitor receives an initial Commercial Growth Snapshot based on their answers.
- The founding-client Audit price is only shown after the completed lead has been delivered.
- Audit-request intent can be captured as a second stage.
- UTM/referrer data is attached to submitted leads.
- Optional GA4 events track funnel stages without intentionally sending contact details or free-text answers to analytics.
- Analytics is consent-aware.
- Privacy page added.

## 1. Connect lead delivery before publishing this version
This site is designed to use a secure form endpoint. Formspree is the easiest option for a GitHub Pages site.

1. Create a Formspree account and a new form.
2. Set the notification email to `lauraqbusiness@gmail.com`.
3. Copy the form endpoint. It will look like:
   `https://formspree.io/f/xxxxxxxx`
4. Open `config.js`.
5. Paste it into `formEndpoint`.

Until this is done, the Commercial Growth Check deliberately will **not reveal pricing**, because it cannot confirm that the warm lead was safely captured first.

## 2. Optional: connect Google Analytics 4
Create a GA4 web data stream for `https://commercialgrowth.ie` and copy the Measurement ID, e.g. `G-XXXXXXXXXX`.

Paste that into `gaMeasurementId` in `config.js`.

Analytics only loads after the visitor chooses **Allow analytics**. Name, email, business name and free-text answers are never intentionally passed into GA4 events.

### Funnel events included
- `cg_check_opened`
- `cg_check_started`
- `cg_contact_step_completed`
- `cg_diagnostic_completed`
- `cg_price_viewed`
- `cg_question_clicked`
- `cg_audit_requested`
- `cg_check_closed`

The random `lead_id` can be used to connect an anonymous analytics journey with the lead reference in the form submission without using their email address as an analytics identifier.

## 3. Attribution
The site automatically attaches these to lead submissions when present:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- first referrer
- landing page

Useful launch links:

Instagram bio:
`https://commercialgrowth.ie/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch`

Instagram Story:
`https://commercialgrowth.ie/?utm_source=instagram&utm_medium=story&utm_campaign=launch`

LinkedIn:
`https://commercialgrowth.ie/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch`

Direct outreach:
`https://commercialgrowth.ie/?utm_source=outreach&utm_medium=direct&utm_campaign=founding_clients`

You can also vary `utm_content` by post or message so you learn which creative actually produces diagnostics.

## 4. What counts as each funnel stage
- **Visitor**: site visit.
- **Check started**: user presses Start the Check.
- **Contact step completed**: email question completed.
- **Diagnostic completed**: answers successfully sent to the form endpoint.
- **Pricing viewed**: pricing screen shown immediately after successful lead capture.
- **Audit requested**: user presses Request my Audit and that intent is submitted.
- **Paid Audit**: mark manually once payment is received.
- **Consultancy**: mark manually when an Audit converts to ongoing work.

Because the price screen only appears after a successful lead submission, every completed form in your inbox is a prospect who reached the pricing stage.

## 5. Upload to GitHub
Upload the contents of this folder to the root of the existing GitHub Pages repository and commit the changes. Keep the included `CNAME` file.

## Launch test
Before sharing publicly:
1. Complete the Check yourself from an incognito window.
2. Confirm the form submission arrives at Laura's email.
3. Confirm the price only appears after successful submission.
4. Press Request my Audit and confirm the second intent arrives.
5. Test on iPhone/Android and desktop.
6. Test with an Instagram UTM link and confirm the UTM fields appear in the submission.
7. Verify `https://commercialgrowth.ie` and `https://www.commercialgrowth.ie` both work.
