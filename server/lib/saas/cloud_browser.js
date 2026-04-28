// Cloud browser provider abstraction. Phase 4.5 W4: Steel.dev integration.
// Steel exposes a `sessionViewerUrl` per session that's iframe-embeddable
// (no X-Frame-Options blocking, unlike Browserbase's dashboard), so we can
// drop the live view directly inside the GiveMeSpace browser surface
// without a custom video stream pipeline.
//
// To swap providers later (Browserbase via custom CDP relay, Anchor,
// Hyperbrowser, etc.), implement the same { create, release } interface
// and switch the PROVIDER constant.

const STEEL_API = "https://api.steel.dev/v1";

function readSteelApiKey() {
  return String(process.env.STEEL_API_KEY || "").trim();
}

function readSteelDefaultRegion() {
  return String(process.env.STEEL_REGION || "").trim() || undefined;
}

export function isCloudBrowserConfigured() {
  return Boolean(readSteelApiKey());
}

// Create a Steel session. Throws on HTTP error with statusCode propagated.
export async function createCloudSession({ initialUrl, region } = {}) {
  const apiKey = readSteelApiKey();
  if (!apiKey) {
    const err = new Error(
      "Cloud browser provider is not configured. Set STEEL_API_KEY env var. " +
        "See docs/CLOUD-BROWSER-SETUP.md for setup."
    );
    err.statusCode = 503;
    throw err;
  }

  const body = {};
  if (initialUrl) body.startUrl = String(initialUrl);
  const resolvedRegion = region || readSteelDefaultRegion();
  if (resolvedRegion) body.region = resolvedRegion;

  const resp = await fetch(`${STEEL_API}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Steel-Api-Key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Steel /sessions returned ${resp.status}: ${text || resp.statusText}`);
    err.statusCode = resp.status >= 500 ? 502 : resp.status;
    throw err;
  }

  const data = await resp.json();
  return {
    sessionId: data.id,
    viewerUrl: data.sessionViewerUrl || data.debugUrl || null,
    websocketUrl: data.websocketUrl || null,
    expiresAt: data.expiresAt || null,
    raw: data
  };
}

export async function releaseCloudSession({ sessionId }) {
  const apiKey = readSteelApiKey();
  if (!apiKey || !sessionId) return false;
  const resp = await fetch(`${STEEL_API}/sessions/${encodeURIComponent(sessionId)}/release`, {
    method: "POST",
    headers: { "Steel-Api-Key": apiKey }
  });
  return resp.ok;
}

export const CLOUD_BROWSER_PROVIDER = "steel";
