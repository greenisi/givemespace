// Same gateway redirect for the admin agent's API requests. Mirrors the
// onscreen_agent hook so the admin chat surface (overlay agent) also
// routes through /api/llm_proxy and is metered/quota-checked the same
// way as the in-space agent.

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
  out.requestUrl = GATEWAY_ENDPOINT;
  if (out.settings && typeof out.settings === "object") {
    out.settings = { ...out.settings, apiEndpoint: GATEWAY_ENDPOINT };
  }
  const headers = out.headers && typeof out.headers === "object" ? { ...out.headers } : {};
  delete headers.Authorization;
  delete headers.authorization;
  delete headers["HTTP-Referer"];
  delete headers["X-OpenRouter-Title"];
  delete headers["X-OpenRouter-Categories"];
  out.headers = headers;
  out.credentials = "include";
  const existingInit =
    out.requestInit && typeof out.requestInit === "object" ? { ...out.requestInit } : {};
  existingInit.credentials = "include";
  out.requestInit = existingInit;
  return out;
}

export default async function givemespaceAdminGatewayHook(hookContext) {
  if (bypassEnabled()) return;
  const apiRequest = hookContext?.result;
  if (!apiRequest || typeof apiRequest !== "object") return;
  const endpoint =
    apiRequest.apiEndpoint || apiRequest.settings?.apiEndpoint || "";
  if (!isOpenRouterEndpoint(endpoint) && endpoint !== GATEWAY_ENDPOINT) return;
  hookContext.result = rewriteRequest(apiRequest);
}
