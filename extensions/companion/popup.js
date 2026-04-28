// Popup UX. Two responsibilities:
//   1. Show current state (is the GiveMeSpace tab open? did the user grant
//      <all_urls>?).
//   2. Hand the user the user-gesture-required button to grant / revoke
//      <all_urls> via chrome.permissions.{request,remove}. CWS reviewers
//      look for exactly this pattern and approve it cleanly.

const el = (id) => document.getElementById(id);

el("version").textContent = "v" + chrome.runtime.getManifest().version;

const APP_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1):3000|givemespace\.ai/i;

async function refreshAppRow() {
  const tabs = await chrome.tabs.query({});
  const onApp = tabs.some((t) => APP_URL_RE.test(t.url || ""));
  const dot = el("appDot");
  dot.classList.toggle("on", onApp);
  dot.classList.toggle("off", !onApp);
  el("appStatus").textContent = onApp
    ? "GiveMeSpace tab detected."
    : "Open givemespace.ai (or localhost:3000) to start.";
}

async function refreshPermRow() {
  const granted = await chrome.permissions.contains({ origins: ["<all_urls>"] });
  const dot = el("permDot");
  dot.classList.toggle("on", granted);
  dot.classList.toggle("off", !granted);
  el("permStatus").textContent = granted
    ? "Browser-wide access: granted."
    : "Browser-wide access: not granted.";
  el("permSub").textContent = granted
    ? "You can revoke at any time. We never read tabs you haven't activated."
    : "Required for the agent to operate non-GiveMeSpace tabs.";
  el("grantBtn").disabled = granted;
  el("grantBtn").style.display = granted ? "none" : "block";
  el("revokeBtn").style.display = granted ? "block" : "none";
}

el("grantBtn").addEventListener("click", async () => {
  // Must be inside a user-gesture handler. Chrome shows the native consent UI.
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
  } catch (err) {
    el("permSub").textContent = "Grant failed: " + (err?.message || err);
    return;
  }
  if (!granted) {
    el("permSub").textContent = "You declined. The agent can still operate the GiveMeSpace tab itself.";
  }
  await refreshPermRow();
});

el("revokeBtn").addEventListener("click", async () => {
  await chrome.permissions.remove({ origins: ["<all_urls>"] });
  await refreshPermRow();
});

(async () => {
  await refreshAppRow();
  await refreshPermRow();
})();
