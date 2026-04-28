# `_core/saas_usage` — usage-bar widget

Floating bottom-right widget that polls `/api/llm_usage` every 30s and reflects the user's tier token quota inline. Mimics Anthropic's "X% used / resets in Yh" affordance on Claude Pro/Max.

## Files

- `usage-bar.js` — auto-mounting client-side widget. Inline styles, no framework dependency. Hidden for admin tier (unlimited).
- `AGENTS.md` — this file.

## Loading

The widget loads via the standard L0 module discovery in `index.html` and is dynamically imported on app boot. The bar is dismissable (click ×) and the dismissal persists in `localStorage["gms.usageBarHidden"]`. To re-show, the user clears localStorage or visits `/usage` (full dashboard).

## Endpoints touched

- `GET /api/llm_usage` — returns `{ tier, allowance, used, remaining, modelsAllowed, windowMs, resetAtMs }`. Admin tier returns `allowance: null` → widget hides.

## Standalone dashboard

`/usage` (`server/pages/usage.html`) is the deeper view — full table, per-model breakdown, reset countdown. Linked from the floating widget on click.
