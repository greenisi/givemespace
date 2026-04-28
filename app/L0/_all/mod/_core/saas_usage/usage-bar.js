// Floating usage bar — Anthropic-style mini widget that lives in the
// bottom-right of the GiveMeSpace SPA, polls /api/llm_usage every 30s,
// and reflects the user's tier quota.
//
// Mounts itself on document_idle by appending a fixed-position container
// to <body>. Click the widget to open the full dashboard at /usage.
//
// Hidden when:
//   - tier is "admin" (unlimited; nothing to show)
//   - tier endpoint returns 401 (not signed in / boot phase)

const ENDPOINT = "/api/llm_usage";
const POLL_MS = 30_000;
const STORAGE_HIDE_KEY = "gms.usageBarHidden";

let mountedRoot = null;
let pollHandle = null;

function fmt(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}

function humanizeMs(ms) {
  if (ms <= 0) return "now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function injectStyles() {
  if (document.getElementById("gms-usage-bar-styles")) return;
  const style = document.createElement("style");
  style.id = "gms-usage-bar-styles";
  style.textContent = `
    .gms-usage-bar {
      position: fixed; bottom: 16px; right: 16px; z-index: 50;
      min-width: 220px; max-width: 280px;
      background: rgba(5, 8, 22, 0.92);
      border: 1px solid rgba(89, 240, 168, 0.25);
      border-radius: 12px;
      padding: 10px 12px;
      font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      color: rgba(239, 245, 255, 0.92);
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      cursor: pointer;
      transition: opacity 200ms;
    }
    .gms-usage-bar[hidden] { display: none; }
    .gms-usage-bar:hover { border-color: rgba(89, 240, 168, 0.6); }
    .gms-usage-bar-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .gms-usage-bar-tier { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #59f0a8; font-weight: 700; }
    .gms-usage-bar-pct { font-size: 16px; font-weight: 600; }
    .gms-usage-bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; margin: 6px 0 6px; }
    .gms-usage-bar-fill { height: 100%; background: #59f0a8; border-radius: 999px; transition: width 300ms ease; }
    .gms-usage-bar-fill.warn { background: #fbbf24; }
    .gms-usage-bar-fill.danger { background: #ef4444; }
    .gms-usage-bar-meta { color: rgba(239, 245, 255, 0.55); font-size: 11px; display: flex; justify-content: space-between; }
    .gms-usage-bar-close {
      position: absolute; top: 4px; right: 6px;
      background: transparent; border: 0; color: rgba(239,245,255,0.4);
      font-size: 14px; cursor: pointer; padding: 2px 6px;
    }
    .gms-usage-bar-close:hover { color: rgba(239,245,255,0.8); }
  `;
  document.head.appendChild(style);
}

function mountIfNeeded() {
  if (mountedRoot) return mountedRoot;
  injectStyles();
  const root = document.createElement("div");
  root.className = "gms-usage-bar";
  root.hidden = true;
  root.innerHTML = `
    <button class="gms-usage-bar-close" aria-label="Hide usage bar">×</button>
    <div class="gms-usage-bar-row">
      <span class="gms-usage-bar-tier" data-tier>—</span>
      <span class="gms-usage-bar-pct" data-pct>—</span>
    </div>
    <div class="gms-usage-bar-track"><div class="gms-usage-bar-fill" data-fill style="width: 0%"></div></div>
    <div class="gms-usage-bar-meta">
      <span data-used>—</span>
      <span data-reset>—</span>
    </div>
  `;
  root.addEventListener("click", (e) => {
    if (e.target.closest(".gms-usage-bar-close")) {
      try { localStorage.setItem(STORAGE_HIDE_KEY, "true"); } catch {}
      root.hidden = true;
      return;
    }
    globalThis.open?.("/usage", "_blank");
  });
  document.body.appendChild(root);
  mountedRoot = root;
  return root;
}

function shouldHide() {
  try { return localStorage.getItem(STORAGE_HIDE_KEY) === "true"; } catch { return false; }
}

async function refresh() {
  if (shouldHide()) {
    if (mountedRoot) mountedRoot.hidden = true;
    return;
  }
  let data;
  try {
    const resp = await fetch(ENDPOINT, { credentials: "include" });
    if (!resp.ok) {
      if (mountedRoot) mountedRoot.hidden = true;
      return;
    }
    data = await resp.json();
  } catch {
    if (mountedRoot) mountedRoot.hidden = true;
    return;
  }
  // Admin tier = unlimited, hide the bar.
  if (data.tier === "admin" || data.allowance === null || data.allowance === undefined) {
    if (mountedRoot) mountedRoot.hidden = true;
    return;
  }
  const root = mountIfNeeded();
  const used = data.used || 0;
  const allowance = data.allowance || 0;
  const pct = allowance > 0 ? Math.min(100, (used / allowance) * 100) : 0;
  const fill = root.querySelector("[data-fill]");
  fill.style.width = `${pct}%`;
  fill.classList.remove("warn", "danger");
  if (pct >= 90) fill.classList.add("danger");
  else if (pct >= 70) fill.classList.add("warn");
  root.querySelector("[data-tier]").textContent = data.tier || "—";
  root.querySelector("[data-pct]").textContent = `${pct.toFixed(0)}%`;
  root.querySelector("[data-used]").textContent = `${fmt(used)} / ${fmt(allowance)} tok`;
  const resetMs = (data.resetAtMs || 0) - Date.now();
  root.querySelector("[data-reset]").textContent = `resets ${humanizeMs(resetMs)}`;
  root.hidden = false;
}

function start() {
  refresh();
  pollHandle = globalThis.setInterval(refresh, POLL_MS);
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  start();
} else {
  globalThis.addEventListener("DOMContentLoaded", start, { once: true });
}

export {};
