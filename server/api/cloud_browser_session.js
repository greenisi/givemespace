// POST /api/cloud_browser_session — provisions a Steel cloud-browser session
// for the authenticated user, returns a viewerUrl the GMS browser surface
// iframes directly. Tier-gated: free tier gets 402 Payment Required, admin
// always allowed, paying tiers (Pro/Studio) allowed once Stripe ships.
//
// Why this is its own endpoint: cloud-browser sessions cost real money per
// minute, so we want a deliberate "start session" gesture (vs. having every
// browser surface auto-create one).

import { createCloudSession, isCloudBrowserConfigured } from "../lib/saas/cloud_browser.js";
import { getDb, upsertUser, getUser } from "../lib/saas/db.js";

function readPayload(context) {
  return context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
    ? context.body
    : {};
}

function isAdmin(context) {
  const groups = Array.isArray(context.user?.groups) ? context.user.groups : [];
  return groups.includes("_admin");
}

function userTier(context) {
  if (isAdmin(context)) return "admin";
  const db = getDb({ projectRoot: context?.projectRoot });
  upsertUser(db, { username: context.user.username, isAdmin: false });
  const row = getUser(db, context.user.username);
  return row?.tier || "free";
}

const TIERS_WITH_CLOUD_ACCESS = new Set(["admin", "pro", "studio"]);

export async function post(context) {
  if (!isCloudBrowserConfigured()) {
    const err = new Error(
      "Cloud browser is not configured on this server. The operator needs to " +
        "set STEEL_API_KEY (see docs/CLOUD-BROWSER-SETUP.md)."
    );
    err.statusCode = 503;
    throw err;
  }

  const tier = userTier(context);
  if (!TIERS_WITH_CLOUD_ACCESS.has(tier)) {
    const err = new Error(
      `Cloud browser requires the Pro tier. You are on '${tier}'. Upgrade at /pricing.`
    );
    err.statusCode = 402;
    err.tier = tier;
    throw err;
  }

  const payload = readPayload(context);
  const session = await createCloudSession({
    initialUrl: payload.url ? String(payload.url) : undefined,
    region: payload.region ? String(payload.region) : undefined
  });

  return {
    provider: "steel",
    sessionId: session.sessionId,
    viewerUrl: session.viewerUrl,
    expiresAt: session.expiresAt,
    tier
  };
}
