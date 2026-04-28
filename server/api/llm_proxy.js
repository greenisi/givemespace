// POST /api/llm_proxy — server-side LLM gateway.
//
// Phase 4 W1 scaffolding: this endpoint enforces auth + meter + tier-model
// validation, then returns a deterministic mock response. W2 will swap the
// mock for a real Anthropic Messages call (with prompt caching) for users
// and OpenAI Responses for admin. The contract is OpenAI-shaped so the
// existing applyOpenRouterHeaders flow can later just retarget here.
//
// Request body (OpenAI chat-completions shape):
//   { model: string, messages: [{role, content}, ...], max_tokens?: number, ... }
//
// Response (mock for now):
//   { id, object: "chat.completion", model, choices: [{message: {role, content}}], usage: {...} }

import { checkBeforeCall, recordUsage } from "../lib/saas/meter.js";

function readPayload(context) {
  return context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
    ? context.body
    : {};
}

function approximateTokens(text) {
  // Cheap server-side estimator until we wire a real tokenizer.
  // 4 chars per token is the conservative public rule of thumb for English.
  if (!text) return 0;
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function totalInputTokens(messages = []) {
  return messages.reduce((sum, msg) => {
    const content = typeof msg?.content === "string"
      ? msg.content
      : JSON.stringify(msg?.content || "");
    return sum + approximateTokens(content);
  }, 0);
}

function buildMockReply(model, messages) {
  const lastUser = [...(messages || [])].reverse().find((m) => m?.role === "user");
  const echo = typeof lastUser?.content === "string"
    ? lastUser.content.slice(0, 80)
    : "";
  return [
    `[givemespace gateway: stubbed ${model}]`,
    echo ? `you said: ${JSON.stringify(echo)}` : "",
    `(W1 scaffolding — real provider call lands in W2)`
  ]
    .filter(Boolean)
    .join("\n");
}

export async function post(context) {
  const payload = readPayload(context);
  const model = String(payload.model || "claude-sonnet-4-6");
  const messages = Array.isArray(payload.messages) ? payload.messages : [];

  // 1. Tier + quota gate. Throws 429/403 as needed.
  const quotaBefore = checkBeforeCall(context, model);

  // 2. Stubbed call. Replace this block in W2 with the real provider switch:
  //      if (quotaBefore.tier === 'admin') → openai.responses.create(...)
  //      else                              → anthropic.messages.create(...)
  const replyText = buildMockReply(model, messages);
  const input_tokens = totalInputTokens(messages);
  const output_tokens = approximateTokens(replyText);
  const usage = { input_tokens, cached_input_tokens: 0, output_tokens };

  // 3. Record usage and price.
  const requestId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { cost_usd_micros } = recordUsage(context, {
    model,
    usage,
    request_id: requestId
  });

  return {
    id: requestId,
    object: "chat.completion",
    model,
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: replyText }
      }
    ],
    usage: {
      prompt_tokens: input_tokens,
      completion_tokens: output_tokens,
      total_tokens: input_tokens + output_tokens,
      cached_input_tokens: 0
    },
    _givemespace: {
      gateway: "stub-w1",
      tier: quotaBefore.tier,
      remaining_after: Number.isFinite(quotaBefore.remaining)
        ? Math.max(0, quotaBefore.remaining - input_tokens - output_tokens)
        : null,
      cost_usd_micros
    }
  };
}
