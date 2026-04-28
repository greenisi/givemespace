// Unified LLM provider abstraction. Every model is reached through one of:
//   - OpenRouter (default for DeepSeek, can also serve Anthropic/OpenAI)
//   - Anthropic direct (for prompt-cache discounts)
//   - OpenAI direct (admin path via OPENAI_API_KEY)
//
// We default to OpenRouter for everything that isn't Anthropic-direct: it
// gives us a single billing surface, single auth, and access to
// DeepSeek + GPT + Claude under one roof. When prompt-cache savings on
// Anthropic models become material, we route those through anthropic-direct.
//
// API surface: callProvider({ model, messages, max_tokens, system,
// temperature }) → { content, model, usage: { input_tokens, output_tokens,
// cached_input_tokens }, raw }

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const ANTHROPIC_BASE = "https://api.anthropic.com";
const OPENAI_BASE = "https://api.openai.com/v1";

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function isAnthropicModelName(model) {
  return /^claude-/i.test(String(model || ""));
}

function isOpenAiModelName(model) {
  return /^(gpt-|o[1-9])/i.test(String(model || ""));
}

// Decide which provider serves this model. Anthropic gets routed direct
// when ANTHROPIC_API_KEY is present (for cache discounts); otherwise
// OpenRouter handles it. Same logic for OpenAI direct.
export function pickProvider(model) {
  const modelStr = String(model || "");
  if (isAnthropicModelName(modelStr) && readEnv("ANTHROPIC_API_KEY")) {
    return "anthropic-direct";
  }
  if (isOpenAiModelName(modelStr) && readEnv("OPENAI_API_KEY")) {
    return "openai-direct";
  }
  return "openrouter";
}

// Map our internal model id to the provider-specific id. Anthropic direct
// uses bare names ("claude-sonnet-4-6"); OpenRouter prefixes Anthropic
// models with "anthropic/" and DeepSeek with "deepseek/".
function resolveOpenRouterModelName(model) {
  const m = String(model || "");
  if (m.startsWith("deepseek/") || m.startsWith("anthropic/") || m.startsWith("openai/")) {
    return m;
  }
  if (isAnthropicModelName(m)) return `anthropic/${m}`;
  if (isOpenAiModelName(m)) return `openai/${m}`;
  return m;
}

function buildOpenRouterHeaders() {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    const err = new Error(
      "Cloud LLM provider is not configured. Set OPENROUTER_API_KEY env var."
    );
    err.statusCode = 503;
    throw err;
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://givemespace.ai",
    "X-Title": "GiveMeSpace"
  };
}

async function callOpenRouter({ model, messages, max_tokens, temperature, system }) {
  const headers = buildOpenRouterHeaders();
  const finalMessages = system
    ? [{ role: "system", content: String(system) }, ...messages]
    : messages;
  const body = {
    model: resolveOpenRouterModelName(model),
    messages: finalMessages,
    max_tokens: max_tokens || 4096
  };
  if (typeof temperature === "number") body.temperature = temperature;

  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(
      `OpenRouter ${resp.status}: ${text || resp.statusText}`
    );
    err.statusCode = resp.status >= 500 ? 502 : resp.status;
    throw err;
  }

  const data = await resp.json();
  const choice = data?.choices?.[0];
  return {
    content: String(choice?.message?.content || ""),
    model: data?.model || body.model,
    usage: {
      input_tokens: data?.usage?.prompt_tokens || 0,
      output_tokens: data?.usage?.completion_tokens || 0,
      cached_input_tokens: data?.usage?.prompt_tokens_details?.cached_tokens || 0
    },
    raw: data
  };
}

async function callAnthropicDirect({ model, messages, max_tokens, temperature, system }) {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set");
    err.statusCode = 503;
    throw err;
  }
  // Anthropic separates system prompt; pull last system message into top-level
  // and pass cache_control for big system blocks.
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "prompt-caching-2024-07-31",
    "Content-Type": "application/json"
  };
  const body = {
    model,
    max_tokens: max_tokens || 4096,
    messages: messages.filter((m) => m.role !== "system")
  };
  if (system) {
    // Mark the system block as cache-friendly — 90% discount on cache reads.
    body.system = [{ type: "text", text: String(system), cache_control: { type: "ephemeral" } }];
  }
  if (typeof temperature === "number") body.temperature = temperature;

  const resp = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Anthropic ${resp.status}: ${text || resp.statusText}`);
    err.statusCode = resp.status >= 500 ? 502 : resp.status;
    throw err;
  }
  const data = await resp.json();
  const text = data?.content?.[0]?.text || "";
  return {
    content: String(text),
    model: data?.model || model,
    usage: {
      input_tokens: data?.usage?.input_tokens || 0,
      output_tokens: data?.usage?.output_tokens || 0,
      cached_input_tokens: data?.usage?.cache_read_input_tokens || 0
    },
    raw: data
  };
}

async function callOpenAiDirect({ model, messages, max_tokens, temperature, system }) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is not set");
    err.statusCode = 503;
    throw err;
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const finalMessages = system
    ? [{ role: "system", content: String(system) }, ...messages]
    : messages;
  const body = {
    model,
    messages: finalMessages,
    max_tokens: max_tokens || 4096
  };
  if (typeof temperature === "number") body.temperature = temperature;
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`OpenAI ${resp.status}: ${text || resp.statusText}`);
    err.statusCode = resp.status >= 500 ? 502 : resp.status;
    throw err;
  }
  const data = await resp.json();
  const choice = data?.choices?.[0];
  return {
    content: String(choice?.message?.content || ""),
    model: data?.model || model,
    usage: {
      input_tokens: data?.usage?.prompt_tokens || 0,
      output_tokens: data?.usage?.completion_tokens || 0,
      cached_input_tokens: data?.usage?.prompt_tokens_details?.cached_tokens || 0
    },
    raw: data
  };
}

// Public dispatch.
export async function callProvider(opts = {}) {
  const provider = pickProvider(opts.model);
  if (provider === "anthropic-direct") return callAnthropicDirect(opts);
  if (provider === "openai-direct") return callOpenAiDirect(opts);
  return callOpenRouter(opts);
}

export function isLlmConfigured() {
  return Boolean(readEnv("OPENROUTER_API_KEY"));
}
