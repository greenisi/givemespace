# Cloud Browser Setup (Phase 4.5 W4)

The "Cloud browser · Pro" picker chip in every browser surface is backed by [Steel.dev](https://steel.dev) — an open‑source headless‑Chromium‑as‑a‑service with an iframe‑embeddable live viewer. This file is the operator setup checklist; users don't need to read it.

## Why Steel (not Browserbase)

Both ship a managed Chromium. Browserbase's "live view" URL is hosted at `browserbase.com` with `X-Frame-Options: SAMEORIGIN`, which means we cannot iframe it inside GiveMeSpace — defeating the whole "rendered inside the app" requirement. Steel ships a `sessionViewerUrl` explicitly designed for embedding. (Custom video streams via CDP/WebSocket would work for Browserbase, but that's a 2‑week build vs. Steel's hours.)

If you'd rather use a different provider, swap the body of `server/lib/saas/cloud_browser.js` — the rest of the stack only depends on the `{ sessionId, viewerUrl }` shape.

## Two env vars

```bash
# Required:
export STEEL_API_KEY="sk_steel_..."

# Optional: pin sessions to a region. Defaults to Steel's auto-route.
export STEEL_REGION="us-east-1"   # or eu-central-1, ap-southeast-1, etc.
```

Get the API key:
1. Sign up at <https://steel.dev>
2. Dashboard → Settings → API keys → Create
3. Steel's free tier currently includes a few hours/month — enough to validate. Paid plans start at $20/mo.

## Restart the server

```bash
# Kill existing dev server first (it caches env at startup):
lsof -ti :3000 | xargs kill -TERM
npm run dev
```

`/api/cloud_browser_session` will now return 503 with a configuration error if the key is missing, or a session if it's set.

## How users get access

| Tier | Cloud browser? |
|---|---|
| `free` | ❌ 402 Payment Required, picker shows pricing CTA |
| `starter` ($19) | ❌ |
| `pro` ($89) | ✅ |
| `studio` ($179) | ✅ |
| `admin` (Isiah) | ✅ always, regardless of Stripe state |

Tier is read from the SaaS sqlite db (`server/data/saas/saas.db`, `users.tier` column). Stripe webhooks update it automatically once Phase 4 W2 ships. Until then, manually promote a test user with:

```bash
sqlite3 server/data/saas/saas.db \
  "UPDATE users SET tier='pro' WHERE username='somebody';"
```

## Cost guardrails

Steel charges per session‑minute. Without limits a user can run the meter forever. To keep the unit economics sane, future work (Phase 4.5 W4.5):

- Cap session length to 30 min for Pro, 2 h for Studio.
- Auto‑release idle sessions after 5 min of no activity.
- Track session minutes in `usage_events` and bill against monthly tier allowance.

For tonight's MVP these aren't enforced — sessions stay open until the Steel API expires them or the user clicks "End session" in the picker.

## Mobile

Cloud browser works on iOS Safari, Android Chrome, anywhere with an iframe. **This is why the cloud path exists** — the Companion extension is desktop‑Chrome‑only and dies on mobile. Cloud browser is the universal solution.
