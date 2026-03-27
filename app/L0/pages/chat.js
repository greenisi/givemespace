import { initializeRuntime } from "../runtime.js";
import { initializeChatInterface } from "../ui/chat-interface.js";

function initializeChatPage() {
  const runtime = initializeRuntime({
    proxyPath: "/api/proxy"
  });

  initializeChatInterface(runtime);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeChatPage, { once: true });
} else {
  initializeChatPage();
}
