// Web-app side of the GiveMeSpace Companion (Chrome extension) protocol.
//
// The companion content script is injected into our page when installed,
// listens for `window.postMessage`, and forwards commands into chrome.*
// APIs we can't touch from a web page (cross-origin DOM, navigation,
// screenshot, etc.).
//
// This module exposes:
//   - companionAvailable  : Promise<boolean>  resolves to true if the
//                           companion announced itself within READY_MS.
//   - companion.cmd(name, args) : Promise<result> — one-shot RPC.
//
// Everything is best-effort: if the companion isn't installed the calls
// reject and the caller falls back to the embedded-browser desktop CTA.

const READY_MS = 1500;
const REQ_TIMEOUT_MS = 30_000;

let announced = false;
let announcedVersion = null;
const pending = new Map();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "gms.announce") {
    announced = true;
    announcedVersion = String(msg.version || "");
    return;
  }

  if (msg.type === "gms.result" && msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    if (msg.ok) resolve(msg.result);
    else reject(new Error(msg.error || "Companion command failed."));
  }
});

export const companionAvailable = new Promise((resolve) => {
  if (announced) return resolve(true);
  // Wait up to READY_MS for an announce. If the page beat the content
  // script (very fast load), proactively ping after a beat.
  const startedAt = Date.now();
  const tick = () => {
    if (announced) return resolve(true);
    if (Date.now() - startedAt >= READY_MS) {
      // One last best-effort ping in case the announce was missed.
      cmd("ping")
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }
    setTimeout(tick, 50);
  };
  tick();
});

export function companionVersion() {
  return announcedVersion;
}

let counter = 0;
function nextId() {
  counter += 1;
  return `gms_${Date.now().toString(36)}_${counter}`;
}

export function cmd(cmdName, args = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Companion command '${cmdName}' timed out after ${REQ_TIMEOUT_MS}ms.`));
      }
    }, REQ_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ type: "gms.cmd", id, cmd: cmdName, args: args || {} }, "*");
  });
}

// Convenience helpers — small, predictable surface for the agent.
export const companion = {
  ping: () => cmd("ping"),
  listTabs: () => cmd("list_tabs"),
  activeTab: () => cmd("active_tab"),
  navigate: (url, tabId) => cmd("navigate", { url, tabId }),
  createTab: (url, active = true) => cmd("create_tab", { url, active }),
  closeTab: (tabId) => cmd("close_tab", { tabId }),
  readPage: (opts = {}) => cmd("read_page", opts),
  click: (ref, tabId) => cmd("click", { ref, tabId }),
  type: (ref, value, tabId) => cmd("type", { ref, value, tabId }),
  screenshot: (opts = {}) => cmd("screenshot", opts)
};
