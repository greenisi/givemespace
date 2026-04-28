// Frontend client for /api/cloud_browser_session.
//
// Used by the "Cloud browser · Pro" mode in browser-frame.html: when the
// user taps "Start cloud session" we POST here, get back a viewerUrl, and
// iframe it inline. Errors propagate with the server's statusCode so the
// UI can show "Configure STEEL_API_KEY" (503), "Upgrade to Pro" (402),
// or generic failure messaging.

const SESSION_ENDPOINT = "/api/cloud_browser_session";
const RELEASE_ENDPOINT = "/api/cloud_browser_release";

async function postJson(endpoint, body) {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {})
  });
  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const err = new Error(data?.error || `HTTP ${resp.status} ${resp.statusText}`);
    err.statusCode = resp.status;
    err.tier = data?.tier;
    throw err;
  }
  return data;
}

export async function createCloudSession({ url } = {}) {
  return postJson(SESSION_ENDPOINT, url ? { url } : {});
}

export async function releaseCloudSession({ sessionId } = {}) {
  if (!sessionId) return { released: false };
  return postJson(RELEASE_ENDPOINT, { sessionId });
}
