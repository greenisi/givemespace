document.getElementById("version").textContent =
  "v" + chrome.runtime.getManifest().version;

const dot = document.getElementById("dot");
const status = document.getElementById("status");

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";
    const onApp = /^https?:\/\/(localhost|127\.0\.0\.1):3000|givemespace\.ai/i.test(url);
    if (onApp) {
      dot.classList.remove("off");
      dot.classList.add("on");
      status.textContent = "Connected — this tab can use the agent.";
    } else {
      dot.classList.remove("on");
      dot.classList.add("off");
      status.textContent = "Open givemespace.ai in another tab to start.";
    }
  } catch (err) {
    status.textContent = "Companion error: " + (err?.message || err);
  }
})();
