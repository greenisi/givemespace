// POST /api/cloud_browser_release — releases an active Steel session so we
// stop burning credits when the user clicks "End session" in the picker.
// Auth-gated (any logged-in user can release a session ID they hold; the
// session ID is the unguessable token).

import { releaseCloudSession } from "../lib/saas/cloud_browser.js";

function readPayload(context) {
  return context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
    ? context.body
    : {};
}

export async function post(context) {
  const payload = readPayload(context);
  const sessionId = String(payload.sessionId || "").trim();
  if (!sessionId) {
    const err = new Error("sessionId is required");
    err.statusCode = 400;
    throw err;
  }
  const released = await releaseCloudSession({ sessionId });
  return { released, sessionId };
}
