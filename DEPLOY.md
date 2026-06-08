# aiguide.co.za — deployment runbook

Static Astro site. Build output is `dist/`. Recommended host: **Cloudflare Pages** (Chad's standard).
Domain `aiguide.co.za` is registered (2026-06-08) and currently on **GoDaddy DNS** (`ns75/76.domaincontrol.com`).

Production-ready as of 2026-06-08: Lighthouse 100/100/100/100 on the home, 0-blocking schema audit
across 47 pages, 0 broken internal links, canonical + sitemap aligned (trailing-slash), security
headers, 404, analytics + IndexNow wired. The only blockers are operator decisions (below).

## Pre-flight (operator)
- [ ] Confirm **Adam's** `linkedin.com/in/...` + `about.me/...` (Chad's are verified). Edit `src/content/authors/adam-sacharowitz.md` `sameAs`.
- [ ] Confirm the **Zaiq contact funnel works** (`zaiq.co.za/#contact` / WhatsApp). Every CTA routes there; a dead funnel = leaked leads. If it is a placeholder, fix it first or point CTAs at a working `mailto:hello@zaiq.co.za`.
- [ ] (Optional, before launch) create Crunchbase + X + Zaiq company LinkedIn, then add to org/author `sameAs`.

## Build
```bash
cd ai-problem-solver-venture/aiguide
npm ci
npm run build        # -> dist/  (47 pages + sitemap-index.xml)
```

## Deploy (Cloudflare Pages)
**Option A — Wrangler (direct upload):**
```bash
# needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for the chosen CF account
npx wrangler pages deploy dist --project-name aiguide --branch main
```
**Option B — CF dashboard:** create a Pages project `aiguide`; build command `npm run build`; output dir `dist`; root dir `ai-problem-solver-venture/aiguide`.

## Domain
1. In the Pages project, add custom domains **aiguide.co.za** and **www.aiguide.co.za**.
2. DNS (GoDaddy): either CNAME `aiguide` -> `<project>.pages.dev` (+ CNAME `www`), or move nameservers to Cloudflare. `www` -> apex is handled by `public/_redirects`.
3. `public/_headers` (HSTS/CSP/etc.) and `public/_redirects` (www + Plausible proxy) ship automatically. **Verify the CSP on first deploy** (browser console for violations; it allows `'unsafe-inline'` for the inline island scripts + Plausible; relax/tighten if needed).

## Post-deploy checklist
1. `curl -I https://aiguide.co.za/` -> 200 + HTTPS + the security headers. Spot-check 3 pages + a tool + `/404` (should 404).
2. **Plausible** (CA ETKIND account): add site `aiguide.co.za`; confirm events fire (the `outbound-links` script auto-tracks clicks to zaiq.co.za = the conversion goal). Loads directly from plausible.io (reliable + ad-block resistance can be added later via a Cloudflare Worker proxy; `_redirects` does not proxy external origins). Never add GA4.
3. **GSC** (correct account per per-browser rule): add Domain property `sc-domain:aiguide.co.za` (DNS TXT); submit `https://aiguide.co.za/sitemap-index.xml`.
4. **Bing Webmaster**: add + verify (DNS CNAME, not GSC import in the MCP browser); submit the sitemap.
5. **IndexNow**: key `9ca0de57c8c8ff087c339f3fb36b47c0` (live at `/9ca0de57c8c8ff087c339f3fb36b47c0.txt`); submit all 47 URLs to `https://api.indexnow.org/indexnow`.
6. **Baseline AI probe** (`/ai-knowledge-probe`) for the must-win queries ("ai for south african business", "how much does a website cost in south africa", "who can build a whatsapp chatbot in south africa", "Chad Etkind", "Zaiq") so Phase 10 can measure the lift.
7. Register the live state in `markets/_global/ops/site-ops-registry.json` (already entered as `aiguide-co-za`) + STATE-OF-EMPIRE; run `npm run ops:all`.

## Notes
- Analytics is dormant until the domain is live (Plausible filters by `data-domain`), so the wiring is safe to ship now.
- The SA AI Visibility Index publishes methodology only; run the first real data pass before quoting any numbers.
