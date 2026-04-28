# `_core/agent_visual` — ghost cursor + agent activity overlay

When the agent is doing something, the user should see it happening. This module is the visual layer: an animated cursor that hops between targets, target-element pulse highlights, and a status pill that narrates what the agent is up to.

See `docs/PHASE-5-AI-DRIVES-UI.md` for the full vision.

## Files

- `AGENTS.md` — this overview
- `ghost-cursor.js` — fixed-position SVG cursor, animates to coords on `gms:agent-action` events. Tonight: minimal mounting + style. Animation logic firms up in Phase 5 W2.
- `status-pill.js` — small bottom-of-screen pill that displays the agent's current step ("Clicking 'Save'..."). Mounts at app boot.
- `index.css` — visual styles (cursor SVG, pill, pulse keyframe).

## Loading

Auto-mounts via `<script type="module" src="/mod/_core/agent_visual/ghost-cursor.js">` in `server/pages/index.html` (same pattern as `_core/saas_usage/usage-bar.js`).

## Event protocol

Listens for `gms:agent-event` CustomEvent on globalThis. Event detail shape:
```js
{
  type: "agent.tool.invoke" | "agent.tool.complete" | "agent.thinking" | ...,
  target: "selector or human description",
  params: { ... },
  ts: Date.now()
}
```

Other modules emit via `space.events.emit(...)` (see `_core/agent_tools/events-bridge.js`).

## Status

| | Status |
|---|---|
| Status pill (bottom of screen) | ✅ shipping tonight (minimal) |
| Ghost cursor SVG mount + position | ✅ shipping tonight (mount only) |
| Cursor animation between targets | 🚧 Phase 5 W2 |
| Element pulse highlight | 🚧 Phase 5 W2 |
| Sub-action breadcrumb scrubber | 🚧 Phase 5 W3 |
