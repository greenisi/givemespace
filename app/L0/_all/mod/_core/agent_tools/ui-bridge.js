// space.ui.* — agent tool surface for driving the GiveMeSpace UI itself
// (open spaces, create widgets, click panel buttons, fill forms).
//
// STATUS: Phase 5 W1 stub. The real implementation needs to:
//   1. Resolve a "target" string (aria-label / text content / selector)
//      against the live DOM accessibility tree → DOM node ref
//   2. Emit a "ghost-intent" event to _core/agent_visual so the cursor
//      animates BEFORE the click lands
//   3. Wait for animation completion → invoke the real DOM event
//   4. Wait for DOM-settled signal (mutation observer or framework
//      microtask flush) → return structured result to caller
//
// Implementation reuses _core/web_browsing's ref-resolution patterns.
// A11y-tree probe lives in _core/skillset/ext/skills/screenshots/ already;
// extending it for UI-target resolution is the W1 work.
//
// Until then, agents should drive the UI through the existing
// `space.skills.run(...)` and `space.spaces.*` helpers.

const NOT_IMPLEMENTED_MESSAGE =
  "space.ui.* is staged for Phase 5 W1. Use space.skills.run() and " +
  "space.spaces.* in the meantime; see docs/PHASE-5-AI-DRIVES-UI.md.";

function notImplemented() {
  return {
    ok: false,
    error: NOT_IMPLEMENTED_MESSAGE,
    phase: "5/W1"
  };
}

export const ui = {
  click(target) { return notImplemented(); },
  type(target, value) { return notImplemented(); },
  openSpace(id) { return notImplemented(); },
  createWidget(type, opts) { return notImplemented(); },
  scrollTo(target) { return notImplemented(); },
  dragDrop(from, to) { return notImplemented(); },
  openPanel(name) { return notImplemented(); },
  highlight(target, durationMs) { return notImplemented(); }
};

export default ui;
