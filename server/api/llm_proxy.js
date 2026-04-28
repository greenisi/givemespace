// POST /api/llm_proxy — server-side LLM gateway. Phase 4 W2.
//
// Smart router: picks DeepSeek V3 / R1 / Claude Sonnet / Opus based on
// request complexity, clamped to the user's tier whitelist. Forwards to
// the chosen provider (OpenRouter by default; Anthropic-direct when
// ANTHROPIC_API_KEY is set, for prompt-cache discounts). Records real
// usage in the SaaS meter, enforces tier allowance, returns OpenAI-shaped
// response for frontend compatibility.
//
// Request body:
//   { messages: [{role, content}, ...], model?: string, max_tokens?: number,
//     temperature?: number, system?: string }
//
// Response (OpenAI chat-completion shape + _givemespace usage envelope):
//   { id, object: "chat.completion", model, choices, usage, _givemespace: {...} }

import { checkBeforeCall, recordUsage } from "../lib/saas/meter.js";
import { callProvider, isLlmConfigured } from "../lib/saas/llm_provider.js";
import { routeRequest } from "../lib/saas/router.js";
import { getQuota } from "../lib/saas/meter.js";

function readPayload(context) {
  return context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
    ? context.body
    : {};
}

export async function post(context) {
  if (!isLlmConfigured()) {
    const err = new Error(
      "LLM gateway is not configured. Operator: set OPENROUTER_API_KEY env var."
    );
    err.statusCode = 503;
    throw err;
  }

  const payload = readPayload(context);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const explicitModel = payload.model ? String(payload.model) : null;
  const system = payload.system ? String(payload.system) : "";
  const max_tokens = Number.isFinite(payload.max_tokens) ? payload.max_tokens : 4096;
  const temperature = Number.isFinite(payload.temperature) ? payload.temperature : undefined;

  // 1. Quota first — fail fast if user is over allowance.
  const quotaBefore = getQuota(context);
  if (quotaBefore.remaining !== null && quotaBefore.remaining <= 0) {
    const err = new Error("Token quota exceeded for this billing period.");
    err.statusCode = 429;
    err.quota = quotaBefore;
    throw err;
  }

  // 2. Smart route.
  const route = routeRequest({
    messages,
    system,
    explicitModel,
    allowedModels: quotaBefore.modelsAllowed
  });

  // 3. Tier-model gate (router.clampModelToTier already handled the downgrade,
  // but re-check in case explicitModel forced something out of tier).
  checkBeforeCall(context, route.model);

  // 4. Forward to provider.
  const result = await callProvider({
    model: route.model,
    messages,
    max_tokens,
    temperature,
    system
  });

  // 5. Record usage.
  const requestId = `gms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { cost_usd_micros } = recordUsage(context, {
    model: route.model,
    usage: result.usage,
    request_id: requestId
  });

  // 6. OpenAI-shaped response (for frontend compatibility).
  return {
    id: requestId,
    object: "chat.completion",
    model: result.model,
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: result.content }
      }
    ],
    usage: {
      prompt_tokens: result.usage.input_tokens,
      completion_tokens: result.usage.output_tokens,
      total_tokens: result.usage.input_tokens + result.usage.output_tokens,
      cached_input_tokens: result.usage.cached_input_tokens
    },
    _givemespace: {
      gateway: "w2",
      tier: quotaBefore.tier,
      route_score: route.score,
      route_picked: route.picked,
      route_final: route.model,
      route_downgraded: route.downgraded,
      remaining_after:
        quotaBefore.remaining === null
          ? null
          : Math.max(
              0,
              quotaBefore.remaining - result.usage.input_tokens - result.usage.output_tokens
            ),
      cost_usd_micros
    }
  };
}
