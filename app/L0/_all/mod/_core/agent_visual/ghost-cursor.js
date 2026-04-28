// Ghost cursor + agent status pill — visual feedback when the agent is
// doing something. Mounts on app boot; subscribes to `gms:agent-event`
// CustomEvents and reflects activity inline.
//
// Phase 5 foundation (tonight): cursor + pill mount, status text reflects
// "agent.thinking" / "agent.tool.invoke" / "agent.tool.complete" events.
// Animation between targets and element pulse-highlights are Phase 5 W2 work.

const CURSOR_SIZE = 22;
const PILL_FADE_MS = 1500;

function injectStyles() {
  if (document.getElementById("gms-agent-visual-styles")) return;
  const style = document.createElement("style");
  style.id = "gms-agent-visual-styles";
  style.textContent = `
    .gms-ghost-cursor {
      position: fixed; pointer-events: none; z-index: 9999;
      width: ${CURSOR_SIZE}px; height: ${CURSOR_SIZE}px;
      transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms;
      opacity: 0;
      filter: drop-shadow(0 4px 12px rgba(89, 240, 168, 0.4));
    }
    .gms-ghost-cursor.active { opacity: 1; }
    .gms-ghost-cursor svg { width: 100%; height: 100%; }
    .gms-ghost-cursor svg path {
      fill: #59f0a8;
      stroke: #050816;
      stroke-width: 1.2;
    }
    .gms-agent-status-pill {
      position: fixed; bottom: 16px; left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      max-width: 480px;
      padding: 8px 16px;
      background: rgba(5, 8, 22, 0.92);
      border: 1px solid rgba(89, 240, 168, 0.35);
      border-radius: 999px;
      color: rgba(239, 245, 255, 0.92);
      font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      backdrop-filter: blur(10px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 200ms;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gms-agent-status-pill.active { opacity: 1; }
    .gms-agent-status-pill::before {
      content: "•";
      display: inline-block;
      color: #59f0a8;
      margin-right: 8px;
      animation: gms-agent-pulse 1.5s ease-in-out infinite;
    }
    @keyframes gms-agent-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function mountCursor() {
  const cursor = document.createElement("div");
  cursor.className = "gms-ghost-cursor";
  cursor.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2 L3 18 L8 14 L11 21 L14 19 L11 13 L18 13 Z" />
    </svg>
  `;
  cursor.style.transform = `translate(-${CURSOR_SIZE}px, -${CURSOR_SIZE}px)`;
  document.body.appendChild(cursor);
  return cursor;
}

function mountStatusPill() {
  const pill = document.createElement("div");
  pill.className = "gms-agent-status-pill";
  pill.textContent = "";
  document.body.appendChild(pill);
  return pill;
}

let cursor = null;
let pill = null;
let pillFadeHandle = null;

function moveCursorTo(x, y) {
  if (!cursor) return;
  cursor.style.transform = `translate(${x}px, ${y}px)`;
  cursor.classList.add("active");
}

function setStatus(text) {
  if (!pill) return;
  pill.textContent = String(text || "");
  if (!text) {
    pill.classList.remove("active");
    return;
  }
  pill.classList.add("active");
  if (pillFadeHandle) clearTimeout(pillFadeHandle);
  pillFadeHandle = setTimeout(() => {
    pill.classList.remove("active");
  }, PILL_FADE_MS);
}

function describeEvent(detail) {
  if (!detail) return "";
  const t = detail.type || "";
  if (t === "agent.thinking") return "Thinking…";
  if (t === "agent.tool.invoke") return `${detail.target || "Working"}…`;
  if (t === "agent.tool.complete") return "Done.";
  if (t === "agent.error") return `Error: ${detail.params?.message || "see console"}`;
  return detail.target || "";
}

function handleAgentEvent(event) {
  const detail = event?.detail;
  if (!detail) return;
  const text = describeEvent(detail);
  if (text) setStatus(text);

  // If event includes coordinates, hop the cursor (Phase 5 W2 will resolve
  // selectors → coords automatically; tonight this only fires when emitter
  // explicitly provides coords).
  const coords = detail.params?.coords;
  if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
    moveCursorTo(coords.x, coords.y);
  }
}

function start() {
  injectStyles();
  cursor = mountCursor();
  pill = mountStatusPill();
  globalThis.addEventListener("gms:agent-event", handleAgentEvent);
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  start();
} else {
  globalThis.addEventListener("DOMContentLoaded", start, { once: true });
}

// Public API for callers that want to drive the visual layer directly
// (tests, debug consoles, future phase work).
export const visual = {
  setStatus,
  moveCursorTo,
  hideCursor() { if (cursor) cursor.classList.remove("active"); }
};

export default visual;
