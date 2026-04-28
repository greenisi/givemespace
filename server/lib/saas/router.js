// Smart model router. Picks the cheapest model that's likely to handle the
// request well. Route order:
//
//   trivial / chat / format    → deepseek/deepseek-chat-v3-0324  ($0.27/$1.10)
//   complex coding / reasoning → deepseek/deepseek-r1            ($0.55/$2.19)
//   tool-heavy / long context  → claude-sonnet-4-6               ($3/$15)
//   explicit "best" hint       → claude-opus-4-7                 ($15/$75)
//
// The router output is then filtered against the user's tier whitelist —
// if a Spark user gets routed to Sonnet, we downgrade to the best model
// their tier allows (DeepSeek V3) rather than 403.

const DEEPSEEK_V3 = "deepseek/deepseek-chat-v3-0324";
const DEEPSEEK_R1 = "deepseek/deepseek-r1";
const CLAUDE_SONNET = "claude-sonnet-4-6";
const CLAUDE_OPUS = "claude-opus-4-7";

const COMPLEX_KEYWORD_RE =
  /\b(refactor|debug|algorithm|optimize|complexity|prove|derive|step-?by-?step|chain[- ]of[- ]thought|reason carefully|analyze deeply)\b/i;
const EXPLICIT_BEST_RE =
  /\b(use (?:the )?(?:best|smartest|most capable) model|use opus|use claude|highest quality)\b/i;
const TOOL_USE_HINT_RE = /\b(?:tool[_ -]?call|tool_use|function[_ -]?call|<tool>|<\/tool>)/i;

function joinedText(messages = []) {
  return messages
    .map((m) => (typeof m?.content === "string" ? m.content : JSON.stringify(m?.content || "")))
    .join("\n");
}

function approxTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

// Higher score = harder request. 0–10 scale.
export function scoreComplexity({ messages = [], system = "", explicitModel = null } = {}) {
  if (explicitModel && /opus/i.test(explicitModel)) return 10;
  if (explicitModel && /sonnet/i.test(explicitModel)) return 7;
  if (explicitModel && /haiku|deepseek/i.test(explicitModel)) return 1;

  const text = joinedText(messages) + "\n" + String(system || "");
  let score = 0;

  // Explicit best-model request → top tier.
  if (EXPLICIT_BEST_RE.test(text)) score += 6;

  // Complexity keywords.
  if (COMPLEX_KEYWORD_RE.test(text)) score += 2;

  // Code blocks present → likely coding task.
  const codeBlocks = (text.match(/```/g) || []).length;
  if (codeBlocks >= 2) score += 2;

  // Tool calls / structured output → Claude is more reliable on schema.
  if (TOOL_USE_HINT_RE.test(text)) score += 3;

  // Long input.
  const inputTokens = approxTokens(text);
  if (inputTokens > 100_000) score += 4;
  else if (inputTokens > 30_000) score += 2;
  else if (inputTokens > 8_000) score += 1;

  // Multi-turn agent loop → favor stronger reasoning model.
  if (messages.length >= 8) score += 1;

  return Math.min(10, score);
}

export function pickModelForScore(score) {
  if (score >= 7) return CLAUDE_OPUS;
  if (score >= 4) return CLAUDE_SONNET;
  if (score >= 2) return DEEPSEEK_R1;
  return DEEPSEEK_V3;
}

// If the picked model isn't allowed at the user's tier, fall back to the
// best one in their whitelist (which is ordered cheapest→most expensive
// in pricing.js's TIERS[tier].models).
export function clampModelToTier(picked, allowedModels) {
  if (!Array.isArray(allowedModels) || allowedModels.length === 0) return picked;
  if (allowedModels.includes(picked)) return picked;
  // Walk down the preference order: opus → sonnet → r1 → v3.
  const fallbackOrder = [CLAUDE_OPUS, CLAUDE_SONNET, DEEPSEEK_R1, DEEPSEEK_V3];
  for (const candidate of fallbackOrder) {
    if (allowedModels.includes(candidate)) return candidate;
  }
  // Final fallback — first allowed model.
  return allowedModels[0];
}

export function routeRequest({ messages, system, explicitModel, allowedModels }) {
  const score = scoreComplexity({ messages, system, explicitModel });
  const picked = pickModelForScore(score);
  const final = clampModelToTier(picked, allowedModels);
  return { model: final, picked, score, downgraded: final !== picked };
}
