// GET /api/llm_usage — returns the current user's quota for the usage bar.
//
// Shape:
//   { tier, allowance, used, remaining, modelsAllowed, windowMs, resetAtMs }
// `allowance` and `remaining` are Infinity for admin tier — JSON serializes
// those as `null`, so the FE treats null as "unlimited".

import { getQuota } from "../lib/saas/meter.js";

function jsonSafe(quota) {
  const out = { ...quota };
  if (!Number.isFinite(out.allowance)) out.allowance = null;
  if (!Number.isFinite(out.remaining)) out.remaining = null;
  return out;
}

export function get(context) {
  const quota = getQuota(context);
  return jsonSafe(quota);
}
