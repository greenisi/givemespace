// GiveMeSpace SaaS gateway redirect hook.
//
// Runs LAST in the prepareOnscreenAgentApiRequest end-chain (zz prefix
// guarantees alphabetical-last load order over the existing OpenRouter
// hook). When the agent prepared an OpenRouter call, we rewrite it to
// hit our server's /api/llm_proxy endpoint instead. The server then:
//   - authenticates the user (session cookie)
//   - enforces tier quota (cuts off Spark users at 1.5M tokens/mo)
//   - smart-routes to DeepSeek / Claude / etc. via our master key
//   - logs usage for the bar widget + future Stripe metering
//
// Result: the user never needs to set or know any LLM API key. They
// pay GiveMeSpace, GiveMeSpace pays providers, single bill.
//
// Self-hosters can disable this hook by deleting this file (or set
// `localStorage.setItem("gms.useDirectOpenRouter", "true")` to bypass
// at runtime — useful for power users who want to BYOK).

import { isOpenRouterEndpoint } from "/mod/_core/open_router/request.js";

const GATEWAY_ENDPOINT = "/api/llm_proxy";
const BYPASS_LOCAL_STORAGE_KEY = "gms.useDirectOpenRouter";

function bypassEnabled() {
  try {
    return globalThis.localStorage?.getItem(BYPASS_LOCAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rewriteRequest(apiRequest) {
  const out = { ...apiRequest };
  out.apiEndpoint = GATEWAY_ENDPOINT;
  // The actual fetch uses requestUrl (set earlier in the prepare chain
  // from settings.apiEndpoint via resolveChatRequestUrl). It's already
  // pointed at openrouter.ai by the time we run, so we have to override
  // here too — otherwise apiEndpoint=/api/llm_proxy is a no-op and the
  // browser tries a cross-origin fetch (no cookies → 401).
  out.requestUrl = GATEWAY_ENDPOINT;
  if (out.settings && typeof out.settings === "object") {
    out.settings = { ...out.settings, apiEndpoint: GATEWAY_ENDPOINT };
  }

  // Drop OpenRouter-specific outbound headers — server uses its own key
  // and identifies the request via the user's session cookie.
  const headers = out.headers && typeof out.headers === "object" ? { ...out.headers } : {};
  delete headers.Authorization;
  delete headers.authorization;
  delete headers["HTTP-Referer"];
  delete headers["X-OpenRouter-Title"];
  delete headers["X-OpenRouter-Categories"];
  out.headers = headers;

  // Ensure cookie travels so the server can authenticate the user.
  // The downstream buildFetchRequestInit() reads requestInit for credentials,
  // not the top-level apiRequest.credentials field, so set it there too.
  out.credentials = "include";
  const existingInit =
    out.requestInit && typeof out.requestInit === "object" ? { ...out.requestInit } : {};
  existingInit.credentials = "include";
  out.requestInit = existingInit;

  return out;
}

export default async function givemespaceGatewayHook(hookContext) {
  if (bypassEnabled()) return;

  const apiRequest = hookContext?.result;
  if (!apiRequest || typeof apiRequest !== "object") return;

  const endpoint =
    apiRequest.apiEndpoint || apiRequest.settings?.apiEndpoint || "";
  if (!isOpenRouterEndpoint(endpoint) && endpoint !== GATEWAY_ENDPOINT) {
    return;
  }

  hookContext.result = rewriteRequest(apiRequest);
}
