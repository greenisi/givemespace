// GiveMeSpace Companion — content script.
// Injected on givemespace.ai (and localhost dev). Sole job: bridge
// `window.postMessage` traffic between the web app and the extension's
// service worker. The web app NEVER talks to chrome.* APIs directly —
// everything goes through this bridge so we work even if the web app
// runs in a sandboxed iframe.

const TOKEN = "gms.cmd";        // request type from page → here
const REPLY = "gms.result";     // reply type from here → page

window.addEventListener("message", (event) => {
  // Only accept messages from this very window (drops postMessage from
  // ads, embedded iframes, browser extensions, etc.).
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || typeof msg !== "object" || msg.type !== TOKEN) return;

  // Forward to background, then post the reply back into the page.
  try {
    chrome.runtime.sendMessage(msg, (reply) => {
      if (chrome.runtime.lastError) {
        window.postMessage(
          {
            type: REPLY,
            id: msg.id,
            ok: false,
            error: String(chrome.runtime.lastError.message || chrome.runtime.lastError)
          },
          "*"
        );
        return;
      }
      window.postMessage(reply || { type: REPLY, id: msg.id, ok: false, error: "no reply" }, "*");
    });
  } catch (error) {
    window.postMessage(
      { type: REPLY, id: msg.id, ok: false, error: String(error?.message || error) },
      "*"
    );
  }
});

// Announce ourselves so the web app can flip its `companionAvailable` flag
// without explicit polling. Sent on every page load.
window.postMessage(
  { type: "gms.announce", version: chrome.runtime.getManifest().version },
  "*"
);
