# Phase 5 — AI Drives the UI (the killer feature)

> **The single feature that makes people cancel ChatGPT and pay $89/mo for GiveMeSpace.** The user types a prompt; the agent visibly *operates* the app — opens spaces, clicks buttons, fills forms, builds widgets — while the user watches. Onboarding becomes a 30-second demo. Trust becomes visceral.

## The user-facing experience

```
USER:  Build me a CRM with a customers table, deals pipeline, contact form.

AGENT: On it. (cursor ghost appears)
       → opens "New Space" panel
       → types "Sales CRM"
       → confirms creation
       → opens widget palette
       → drags a Table widget into top half
       → configures columns: name, email, phone, company, status
       → drags a Kanban widget below it
       → labels columns: Lead → Qualified → Proposal → Closed
       → drags a Form widget on the right
       → wires fields: name, email, message
       → connects form-submit to the customers table

(60 seconds. User watched the whole thing.)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ USER prompt → onscreen agent                                         │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Agent sees its tool palette (loaded from SKILL.md):                  │
│                                                                      │
│   space.ui.click(target)     space.ui.type(target, value)            │
│   space.ui.openSpace(id)     space.ui.createWidget(type, location)   │
│   space.ui.scroll(target)    space.ui.dragDrop(from, to)             │
│   space.ui.highlight(target) space.ui.openPanel(name)                │
│                                                                      │
│   space.browser.navigate(url) space.browser.click(ref)               │
│   space.browser.read()        space.browser.screenshot()             │
│   space.browser.type(value)                                          │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ space.ui.* dispatched through agent_tools/ui-bridge.js:              │
│   - resolves target via accessibility-tree query (string → DOM ref)  │
│   - emits "ghost intent" event to agent_visual/                      │
│   - waits for animation → invokes real handler                       │
│   - returns "ok | error" structured result to agent                  │
│                                                                      │
│ space.browser.* dispatched through                                   │
│ web_browsing/companion-bridge.js OR cloud-browser-bridge.js          │
│ (whichever is the active mode in the active surface)                 │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ agent_visual/ overlays:                                              │
│   - ghost cursor SVG that animates from current position to target   │
│   - target element highlight pulse (300ms)                           │
│   - "Agent is doing X..." status pill at the bottom                  │
│   - sub-action breadcrumb chain so user can replay/scrub             │
└──────────────────────────────────────────────────────────────────────┘
```

## What ships in Phase 5

### W1 — `_core/agent_tools` module
- `agent_tools/ui-bridge.js` — implements `space.ui.*` API
- `agent_tools/browser-bridge.js` — adapter exposing companion + cloud-browser as `space.browser.*`
- `agent_tools/registry.js` — registers tool definitions onto the agent's `space.extend` tree
- `agent_tools/AGENTS.md` — module contract

### W2 — `_core/agent_visual` module
- `agent_visual/ghost-cursor.js` — animated SVG cursor positioned by tool calls
- `agent_visual/highlighter.js` — pulse animation on target elements
- `agent_visual/status-pill.js` — bottom-of-screen "Agent: clicking 'Save'..." text
- Mounts via index.html script tag (same pattern as `_core/saas_usage`)

### W3 — Skill pack + prompt update
- `_core/agent_tools/ext/skills/ui-driver/SKILL.md` — teaches the agent the tool surface, gives 5–10 worked examples
- Update default `system-prompt.md` to mention the new tools and bias toward *doing* over *asking*
- A11y-tree probe so the agent can resolve "the Save button" → DOM ref

### W4 — Demo flows + polish
- Three canned "wow" prompts shipped as default examples in the dashboard:
  1. *"Build me a CRM"*
  2. *"Set up a sales pipeline"*
  3. *"Make a personal habit tracker"*
- Each demo is fully agent-built, no human intervention, in <90 seconds.

## Tool API contract (locked)

```typescript
// All tools return Promise<{ ok: boolean, result?: any, error?: string }>
// All tools fire visual feedback before executing (ghost cursor → animate → click)
// All tools wait for DOM settled before returning

space.ui = {
  // Click an element identified by aria-label, text content, or selector
  click(target: string): Promise<ToolResult>,
  
  // Type into an input/textarea identified by target
  type(target: string, value: string): Promise<ToolResult>,
  
  // Open a space by id
  openSpace(id: string): Promise<ToolResult>,
  
  // Create a new widget. type ∈ {table, kanban, form, chart, note, ...}
  createWidget(type: string, opts?: object): Promise<ToolResult>,
  
  // Scroll target into view
  scrollTo(target: string): Promise<ToolResult>,
  
  // Drag from one location to another
  dragDrop(from: string, to: string): Promise<ToolResult>,
  
  // Open a named panel (settings, skills, history, etc.)
  openPanel(name: string): Promise<ToolResult>,
  
  // Visually highlight a target without clicking (used during explanations)
  highlight(target: string, durationMs?: number): Promise<ToolResult>
};

space.browser = {
  // Routes through Companion (free) or Cloud (Pro) per mode picker
  navigate(url: string): Promise<ToolResult>,
  click(ref: string): Promise<ToolResult>,
  type(ref: string, value: string): Promise<ToolResult>,
  read(): Promise<{ title, url, text, interactive: Array<{ref, tag, text}> }>,
  screenshot(): Promise<{ dataUrl: string }>,
  scroll(direction: 'up' | 'down', amount?: number): Promise<ToolResult>
};
```

## Tonight's commit lays foundation

- `_core/agent_tools/` module structure + bridge stubs
- `_core/agent_visual/` ghost cursor + status pill
- Browser tool registration (companion + cloud already exist; this just exposes them as `space.browser.*`)
- `agent-browse.SKILL.md` teaches agent the browser tool surface

The fuller `space.ui.*` work (resolving "the Save button" → DOM ref via a11y tree) is W2-3 work. Tonight: agentic browsing tools wired and ready to use.

## Why this is THE killer feature

A user trying ChatGPT for the first time gets text back. A user trying GiveMeSpace for the first time *watches an app build itself in front of their eyes.* Different planet of "wow." Conversion math:

| Demo type | "I want this" rate |
|---|---|
| Read a marketing page | ~2% |
| Watch a 30s gif | ~5% |
| Watch the product build itself in your own browser, in 60 seconds | ~25%+ |

The technology to ship this exists in 2026. Most products don't because it's *hard* and the design space is uncomfortable for engineers. We have a clear-enough product (GiveMeSpace = workspace) that this is concretely buildable.
