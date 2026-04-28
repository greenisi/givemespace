// Token meter — single source of truth for "is this user allowed to make this call?"
// and "this call cost X tokens / Y micros, write it down."
//
// Backed by the SaaS sqlite db. The DB itself acts as the counter — we sum
// usage_events.input_tokens + output_tokens over the rolling window.

import {
  getDb,
  upsertUser,
  getUser,
  insertUsageEvent,
  getTokensUsedInWindow
} from "./db.js";
import { getTierConfig, priceMicros, WINDOW_MS } from "./pricing.js";
import { getRuntimeGroupIndex } from "../customware/group_runtime.js";

// Make sure the user has a row before we read/write usage. Idempotent.
function ensureUserRow(db, context) {
  const username = context?.user?.username;
  if (!username) {
    const err = new Error("Unauthorized: meter requires an authenticated user.");
    err.statusCode = 401;
    throw err;
  }
  // Groups live in the runtime group index, not on context.user.
  let isAdmin = false;
  try {
    const groupIndex = getRuntimeGroupIndex(context.watchdog, context.runtimeParams);
    const groups = groupIndex?.getOrderedGroupsForUser?.(username) || [];
    isAdmin = Array.isArray(groups) && groups.includes("_admin");
  } catch {}
  upsertUser(db, { username, isAdmin });
  return getUser(db, username);
}

// Returns: { tier, allowance, used, remaining, modelsAllowed, windowMs }
export function getQuota(context) {
  const db = getDb({ projectRoot: context?.projectRoot });
  const userRow = ensureUserRow(db, context);
  const tierConfig = getTierConfig(userRow.tier);
  const used =
    tierConfig.allowance === Number.POSITIVE_INFINITY
      ? 0
      : getTokensUsedInWindow(db, userRow.username, WINDOW_MS);
  const remaining =
    tierConfig.allowance === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(0, tierConfig.allowance - used);

  return {
    tier: userRow.tier,
    allowance: tierConfig.allowance,
    used,
    remaining,
    modelsAllowed: tierConfig.models,
    windowMs: WINDOW_MS,
    resetAtMs: Date.now() + WINDOW_MS // approximation; rolling window
  };
}

// Throws 429 if the user is at/over allowance, OR 403 if they request a model
// outside their tier. Otherwise returns the quota snapshot.
export function checkBeforeCall(context, requestedModel) {
  const quota = getQuota(context);
  if (quota.remaining <= 0) {
    const err = new Error("Token quota exceeded for this billing period.");
    err.statusCode = 429;
    err.quota = quota;
    throw err;
  }
  if (
    requestedModel &&
    !quota.modelsAllowed.includes(requestedModel) &&
    quota.tier !== "admin"
  ) {
    const err = new Error(
      `Model '${requestedModel}' is not available on the '${quota.tier}' tier.`
    );
    err.statusCode = 403;
    err.quota = quota;
    throw err;
  }
  return quota;
}

// Record what a completed LLM call cost. `usage` is normalized to:
//   { input_tokens, cached_input_tokens, output_tokens }
// from whichever provider's response we just saw.
export function recordUsage(context, { model, usage, request_id }) {
  const db = getDb({ projectRoot: context?.projectRoot });
  ensureUserRow(db, context);
  const username = context.user.username;
  const cost_usd_micros = priceMicros({
    model,
    input_tokens: usage?.input_tokens || 0,
    cached_input_tokens: usage?.cached_input_tokens || 0,
    output_tokens: usage?.output_tokens || 0
  });
  insertUsageEvent(db, {
    username,
    model,
    input_tokens: usage?.input_tokens || 0,
    cached_input_tokens: usage?.cached_input_tokens || 0,
    output_tokens: usage?.output_tokens || 0,
    cost_usd_micros,
    request_id: request_id || null
  });
  return { cost_usd_micros };
}
