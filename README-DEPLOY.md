# Real Living Portal — go-live folder

## What's in here
- `index.html` — the Business Suite (the front door; 23 KB, apps load by URL)
- `apps/crm.html` — Real Living CRM (today's build, cloud-connected)
- `apps/deal_analyzer.html`, `apps/documents.html`, `apps/amortization.html`, `apps/training.html`

## Deploy in ~10 minutes (Netlify)
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page
3. You get a live URL immediately (e.g. https://something.netlify.app)
4. Site settings → Domain management → add `portal.realliving.com` (or your domain) and follow the DNS prompt

Cloudflare Pages works identically: Pages → Create → Direct upload → drag the folder.

## Updating an app later
Replace the one file in `/apps` and re-drag the folder (or use Netlify CLI). The suite serves the new version instantly — no re-pasting, ever.

## Adding a new app (Inventory Check, Opportunity Map…)
1. Drop `myapp.html` into `/apps`
2. In `index.html`, find its card in `CARDS` and add: `url:"apps/myapp.html",`

## Notes
- Everything is same-domain, so logins and saved data inside embedded apps work reliably (Safari included).
- The CRM's "Back to Portal" points to `../index.html`.
- Keep the public marketing site on a separate subdomain (e.g. `reallivingkc.com` public, `portal.` internal).
