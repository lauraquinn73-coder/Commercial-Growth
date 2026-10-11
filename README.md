# Commercial Growth — Complete Website V1.6

Consolidates the V1.3 editorial site, V1.5 legal/Tally pages, the free in-browser Growth Check and Commercial Growth Intelligence scanner V0.2.

**Status:** Local scanner development and automated integration tests pass. **Not publicly deployed.** Live deployment requires a Cloudflare account, Turnstile configuration, provider/legal checks and a real browser test on the user's laptop. Do not push to GitHub until verified.

## Local preview — two PowerShell terminals

Terminal 1 (website; if already running, leave it running):

```powershell
Set-Location "C:\Users\laura\Projects\Commercial Growth"
npx.cmd --yes http-server . -p 8000 -c-1
```

Terminal 2 (scanner engine):

```powershell
Set-Location "C:\Users\laura\Projects\Commercial Growth\scanner-worker"
node --test test/*.test.js
npx.cmd --yes wrangler dev --local --port 8787
```

Open http://127.0.0.1:8787/health — expect JSON with `ok:true`. In another tab open http://127.0.0.1:8000 and try a public business homepage. For the local preview, Cloudflare Turnstile is skipped because the Worker is accessible on localhost. The public Worker requires Turnstile and rate-limit bindings.

If npx asks to install Wrangler, accept. Ctrl+C stops the engine. If port 8787 is in use, stop the older Worker first. Run `node --version` if there are Wrangler install errors.

## Live release — no shortcuts

**Before public launch:**

1. Confirm Cloudflare Workers customer terms/DPA/subprocessors and data-transfer arrangements applicable to your account. Review `privacy.html` and test consent choices; confirm that the scanner's technical logs and retention are documented. Check whether `workers.dev` is acceptable for a limited pilot; Cloudflare recommends a custom domain/route for production.
2. In the Cloudflare dashboard create a free Turnstile widget for **commercialgrowth.ie** and **www.commercialgrowth.ie**. Keep the **secret** private; the **site key** is public.
3. In `scanner-worker`, run `npx.cmd --yes wrangler login`, then `npx.cmd --yes wrangler secret put TURNSTILE_SECRET`. Paste the secret when Wrangler prompts. Do **not** place the secret in `config.js`, any ZIP, email or GitHub.
4. Run `npx.cmd --yes wrangler deploy` in `scanner-worker` to publish the separate Worker. The Wrangler configuration includes a per-visitor and a global rate-limit binding. Check `https://<your-worker>.<your-subdomain>.workers.dev/health`: `ready:true` must appear before the public scanner is connected. A health reply alone does not confirm every security/privacy requirement.
5. In the website `config.js` set `scannerEndpoint` to the **HTTPS worker origin** (without `/scan`) for public use and put the Turnstile **site key** in `turnstileSiteKey`. **Keep the local-preview conditional** so the local site still uses `http://127.0.0.1:8787`.
6. Test the live endpoint through commercialgrowth.ie only: valid homepage, a blocked robots.txt site, a local IP rejection, challenge retry, rate limits, mobile width, broken/unavailable Worker, and local analytics consent. Only then commit and push the site.

This scanner analyses **only HTML that can be fetched without authentication**. It does not execute JavaScript, read analytics, diagnose conversion rates, or prove lost revenue. Some websites block automated access or exceed limits. The public scanner is hidden on production until both an endpoint and a site key are configured.

## Security considerations

- CORS and JavaScript validation are NOT security boundaries; the Worker also validates input, checks DNS responses for public addresses, reads robots.txt and caps output size.
- Rate-limit counters are eventually consistent. They are not strict request quotas. For heavier usage, add WAF/Turnstile rules and observe logs; don't assume the free tier has unlimited usage.
- DNS may change between checking an address and connecting. This code reduces SSRF exposure but cannot guarantee protection against every network-level attack; provider network egress controls and a dedicated security review remain important.
- No page snapshot database is used by this prototype. Operational logs from Cloudflare and the scanned site's server may still contain the requested URL and IP information.
- `TURNSTILE_SECRET` MUST be set in the Worker before any public scans can occur. The Worker fails closed without its secret or rate-limit bindings.

## Project files

- `index.html`, `styles.css`, `script.js`, `config.js` — website, Growth Check, legal and Tally presentation
- `scanner.js` — scanner UI and Turnstile verification token integration
- `scanner-worker/index.js`, `analyse.js`, `security.js`, `wrangler.toml` — Cloudflare Worker scanner backend
- `scanner-worker/test` — Node 22 tests (no external dependencies)
- `privacy.html`, `cookies.html`, `terms.html`, `refunds.html`, `accessibility.html` — website policies

**No GitHub push or production Cloudflare deployment occurs by extracting this package.**
