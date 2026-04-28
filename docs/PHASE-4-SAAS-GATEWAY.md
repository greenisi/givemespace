# Phase 4 — SaaS Gateway Design

> **Goal:** Convert the open-source GiveMeSpace fork into a hosted SaaS where (a) admin (Isiah) bills against his existing ChatGPT subscription via OpenAI's Sign-in-with-ChatGPT, and (b) all paying users consume Claude (Anthropic API) on his master key, metered, with replicated Anthropic-style usage caps and Stripe-billed tiers — at margins that survive heavy users.

## Architecture overview

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (givemespace.ai)                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ GiveMeSpace SPA  (forked space-agent UI)                 │  │
│  │   ├─ usage bar widget (polls /api/usage every 5s)        │  │
│  │   └─ chat composer  →  /api/llm                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────────┘
                               │  HTTPS, session cookie
                               ▼
┌────────────────────────────────────────────────────────────────┐
│  GiveMeSpace LLM Gateway  (Node, in-repo, replaces /open_router)│
│                                                                │
│  /api/llm           → router(user.role)                        │
│       ├─ admin     → openai-chatgpt-oauth   (your sub)         │
│       └─ user      → anthropic-metered      (your master key)  │
│                                                                │
│  /api/usage         → meter.getRemaining(userId)               │
│  /api/billing/*     → Stripe (checkout, portal, webhook)       │
└──────────────────────────────┬─────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
     ┌─────────────────┐               ┌────────────────┐
     │ OpenAI Responses│               │ Anthropic API  │
     │ + ChatGPT OAuth │               │ + prompt cache │
     └─────────────────┘               └────────────────┘
```

## Admin path — OpenAI Sign-in-with-ChatGPT

**What it is:** OpenAI offers a Codex-CLI-style OAuth where calls to the Responses API bill against the user's ChatGPT subscription instead of metered API tokens. Currently supported for OpenAI's own developer tools and approved partner apps.

**Constraints to be honest about:**
- Only OpenAI models. **Claude is not available on this path.**
- Requires registering GiveMeSpace as an OAuth app in OpenAI's developer portal.
- Subject to OpenAI ToS for ChatGPT subscription billing — read the dev policy carefully.
- If the OAuth grant gets revoked or OpenAI changes policy, admin path falls back to your OpenAI API key.

**Implementation:**

1. Register OAuth app at platform.openai.com → Apps → New OAuth App.
2. Redirect URI: `https://givemespace.ai/api/auth/openai/callback`.
3. Scopes: `responses.write` (the ChatGPT-billed API surface).
4. On admin first login → redirect to OpenAI consent → callback writes `users.admin.openai_oauth_token` to L2 user dir (encrypted via existing `user_crypto`).
5. Gateway reads token at request time, calls `https://api.openai.com/v1/responses` with `Authorization: Bearer <token>`.
6. **Fallback:** if token expired/revoked, gateway uses `process.env.OPENAI_API_KEY` (your dev key) — admin sees a banner "Switch back to ChatGPT subscription".

**Files to add/modify:**
- `server/api/auth/openai.js` (new) — OAuth init + callback handlers.
- `server/lib/llm/openai-gateway.js` (new) — Responses API wrapper with token rotation.
- `app/L0/_all/mod/_core/open_router/request.js` (modify) — branch on user role; admin routes to OpenAI gateway.

## User path — Anthropic API with metering

**What it is:** Every paying user gets Claude Sonnet (and optionally Opus/Haiku) via your Anthropic master key, with a server-side meter that enforces tier-specific token caps. The user never sees your key.

**Cost model (April 2026 list prices):**
| Model | Input $/MTok | Output $/MTok | Cached input $/MTok |
|---|---|---|---|
| Haiku 4.5 | $1 | $5 | $0.10 |
| Sonnet 4.6 | $3 | $15 | $0.30 |
| Opus 4.7 | $15 | $75 | $1.50 |

Cache discount = 90% off cache reads ≥1024 tokens. Skill files + `AGENTS.md` + system prompts are perfect cache candidates (repeated across every turn).

**Effective blended cost** (assuming 70% cached input, 60/40 input/output split):
- **Sonnet**: 0.6 × (0.7×$0.30 + 0.3×$3) + 0.4 × $15 = **$6.67/MTok**
- **Haiku**: same math → **$2.06/MTok**

**Smart router**: cheap requests (formatting, extraction, simple Q&A) → Haiku; complex reasoning → Sonnet; only when user explicitly asks for it or task complexity score >0.8 → Opus.

Estimated blended after routing (70% Haiku, 25% Sonnet, 5% Opus): **~$3.40/MTok effective**.

**Implementation:**

```js
// server/lib/llm/anthropic-gateway.js
async function handle(req, user) {
  const tier = await getTier(user.id);              // from Stripe sub
  const remaining = await meter.getRemaining(user.id);
  if (remaining <= 0) throw new HttpError(429, "tier-cap");

  const model = router.pick(req.complexity, tier);  // haiku/sonnet/opus
  const resp = await anthropic.messages.create({
    model,
    messages: req.messages,
    system: req.system,
    cache_control: { type: "ephemeral" },           // cache the system block
    max_tokens: req.max_tokens,
  });
  
  const cost = priceOf(model, resp.usage);
  await meter.decrement(user.id, resp.usage.total_tokens, cost);
  await events.write({ user_id: user.id, model, tokens: resp.usage, cost, ts: Date.now() });
  return resp;
}
```

**Files to add:**
- `server/lib/llm/anthropic-gateway.js`
- `server/lib/llm/router.js` (model selector)
- `server/lib/billing/meter.js` (token + dollar tracking)
- `server/api/usage.js` (returns remaining quota)
- `server/data/usage_events/` (NDJSON or SQLite — daily-rotated)

## Tier structure (locked from earlier conversation)

| Tier | Price | Anthropic equivalent | Token allowance/mo | Models | Real cost @ max | Margin @ max | Margin @ 50% util |
|---|---|---|---|---|---|---|---|
| **Starter** | **$19/mo** | Pro $20 | 5M | Haiku + Sonnet | ~$11 | $8 (42%) | $13 (68%) |
| **Pro** | **$89/mo** | Max 5x $100 | 20M | + Opus on hard | ~$45 | $44 (49%) | $66 (74%) |
| **Studio** | **$179/mo** | Max 20x $200 | 50M | + priority Opus | ~$112 | $67 (37%) | $123 (69%) |

Numbers updated to use blended router cost ($3.40/MTok at Starter → $5.50/MTok at Studio because of higher Opus mix).

**Cap mechanic:** rolling 30‑day window of input+output tokens. Hard‑stop at allowance (no overage by default). Optional one‑click "+1M tokens for $5" overage purchase — pure margin since cache hits make additional tokens cheap.

**Per‑5h rolling sub‑cap** (Anthropic-style): 1/12 of monthly. Prevents bursty users from monopolizing your master key's RPM.

## Stripe wiring

1. Three Stripe products mapped 1:1 to tiers. Recurring monthly + 12‑month commit option (10% off, locks LTV).
2. Webhook handler at `/api/billing/webhook` listens for `customer.subscription.{created,updated,deleted}` → upserts `users.<id>.tier` in L2 user dir.
3. Customer Portal embed at `/billing` for self‑serve cancel/upgrade.
4. Invoice all in USD; tax handled by Stripe Tax (set up once).
5. Free tier: 100K tokens / 30 days, Haiku only. Funnel-top, no credit card.

**Files to add:**
- `server/api/billing/checkout.js` — creates Stripe Checkout session.
- `server/api/billing/webhook.js` — verifies signature, upserts tier.
- `server/api/billing/portal.js` — Customer Portal redirect.
- `server/lib/billing/stripe.js` — Stripe client wrapper.

## Usage UI — replicated Anthropic look

A small fixed widget in the chat composer footer:

```
[████████████░░░░░] 64% used · resets in 4d 12h
                            ⓘ 12.8M / 20M tokens this month
```

- Color: green ≤70%, amber ≤90%, red >90%.
- Tooltip: tokens used, tokens remaining, model breakdown, top 3 expensive turns this period.
- 90% reach: triggers in‑app upgrade nudge.
- 100% reach: chat composer disabled, modal explains options (wait for reset / upgrade / one‑shot overage).

Component: `app/L0/_all/mod/_core/usage_meter/` (new module). Polls `/api/usage` every 5s while the composer is focused, every 60s otherwise.

## Implementation order (3‑week sprint)

**Week 1 — Plumbing.**
- Stand up SQLite for users, subscriptions, usage_events.
- Build `meter.js` with deterministic token accounting.
- Replace `app/L0/_all/mod/_core/open_router/request.js` calls with `/api/llm` proxy stub.
- End‑to‑end "hello world" through proxy with hardcoded admin path → OpenAI key.

**Week 2 — User path + Stripe.**
- Anthropic gateway with prompt caching enabled.
- Smart router (simple complexity heuristic to start: `messages.length > 6 || hasCode → Sonnet, else Haiku`).
- Stripe products + webhook + checkout flow.
- Tier enforcement in `meter.getRemaining` blocks chat at cap.

**Week 3 — Admin OAuth + UI + ship.**
- OpenAI OAuth app registration + callback + token storage.
- Usage meter widget + tooltip.
- E2E test: free user → upgrade to Starter → uses 5M tokens → caps → upgrades to Pro → continues.
- Soft launch on Product Hunt with 100‑user invite list.

## Risks & open questions

1. **Anthropic master‑key RPM cap.** Need to confirm we can serve N concurrent Studio users on a single key. May need to request rate‑limit increase from Anthropic before launch. Action: open ticket once 50 paying users.
2. **OpenAI ChatGPT‑OAuth eligibility.** Not all developer apps get approved for the ChatGPT subscription billing path. If denied → admin falls back to your OpenAI API key (still cheap personal use, not "free").
3. **Cost spike from one bad agent loop.** A user's runaway agent could burn 5M tokens in one chat. Mitigation: per‑request input cap (e.g. 200K tokens), per‑turn output cap (e.g. 32K), session‑level cap (1M tokens before forced "are you sure?" interstitial).
4. **Trademark.** "GiveMeSpace" — clear initial USPTO search before incorporating. "Give me space" as a phrase is unprotectable; the unique compound + logo can be marked.
5. **Customer support load.** A SaaS with 1000 users at $30 ARPU = $30K MRR but ~50 support tickets/week. Need a "low‑touch" onboarding (in‑product walkthrough, no human required for first 30 days).

## Out of scope for Phase 4

- Multi‑tenancy isolation beyond per‑user L2 dirs (single‑node deployment OK to 5K users).
- Team plans / SSO / SAML (defer to Enterprise tier later).
- Self‑hosted user keys (BYOK) — optional Phase 5 to compete with OpenRouter.
- Per‑skill marketplace / paid skills (Phase 6).
