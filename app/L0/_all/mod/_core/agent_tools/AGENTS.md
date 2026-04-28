# `_core/agent_tools` — unified agent tool surface

The single source of truth for what the agent can DO across the GiveMeSpace platform. Existing upstream surfaces (`space.browser`, `space.skills`, `space.spaces`) remain authoritative for their own domains; this module knits them into a coherent `space.ui.*` and `space.web.*` namespace and adds visual feedback hooks consumed by `_core/agent_visual`.

See `docs/PHASE-5-AI-DRIVES-UI.md` for the user-facing vision.

## Status: foundation laid, full implementation in Phases 5-8

| Tool surface | Status | Source |
|---|---|---|
| `space.browser.*` | ✅ shipped (upstream) | `_core/web_browsing/` |
| `space.skills.*` | ✅ shipped (upstream) | `_core/skillset/` |
| `space.spaces.*` | ✅ shipped (upstream) | `_core/spaces/` |
| `space.ui.click/type/openSpace/createWidget/...` | 🚧 Phase 5 W1-W2 | `agent_tools/ui-bridge.js` (stub here) |
| `space.web.create_project/preview/deploy/...` | 🚧 Phase 6 | `agent_tools/web-bridge.js` (planned) |
| `space.data.list_tables/query/insert/...` | 🚧 Phase 7 | `agent_tools/data-bridge.js` (planned) |
| `space.events.emit/...` (workflow log) | 🚧 Phase 8 | `agent_tools/events-bridge.js` (planned) |

## Files in this module

- `AGENTS.md` — this overview
- `ui-bridge.js` — stub that documents the planned `space.ui.*` API. Real impl lands in Phase 5 W1.
- `events-bridge.js` — stub for the workflow event bus that Phase 8 builds on.
- `ext/skills/agentic-browse/SKILL.md` — focused skill teaching the agent to drive the in-app browser surface across Companion / Cloud / Desktop modes (consolidates browser-control + cloud picker awareness)

## Why this module exists

The upstream's `_core/skillset/ext/skills/browser-control/SKILL.md` is excellent but predates our SaaS picker (Companion vs Cloud vs Desktop). Without the awareness of which backend the agent is hitting, prompts like "open google.com and read the headline" can succeed visually but fail to *read back* the content (because Cloud mode is visual-only via Steel's WebRTC stream, while Companion mode supports `content()` reads via the extension's chrome.scripting API).

This module's `agentic-browse` skill (a) acknowledges the three modes and (b) instructs the agent to fall through gracefully (try `content()`; if it errors with "no read in cloud mode," say so to the user and ask if they'd like to switch modes).
