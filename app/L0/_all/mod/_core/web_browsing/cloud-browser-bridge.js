// Frontend client for /api/cloud_browser_session.
//
// Used by the "Cloud browser · Pro" mode in browser-frame.html: when the
// user taps "Start cloud session" we POST here, get back a viewerUrl, and
// iframe it inline. Errors propagate with the server's statusCode so the
// UI can show "Configure STEEL_API_KEY" (503), "Upgrade to Pro" (402),
// or generic failure messaging.

const ENDPOINT = "/api/cloud_browser_session";

export async function createCloudSession({ url } = {}) {
  const body = url ? { url } : {};
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
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
