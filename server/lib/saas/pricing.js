// Provider pricing as of April 2026 (verify monthly — pricing changes).
// All prices are USD per million tokens (MTok). Stored cost in DB is micros.

export const ANTHROPIC_PRICING = {
  "claude-haiku-4-5":  { input: 1,  output: 5,  cached_input: 0.10 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cached_input: 0.30 },
  "claude-opus-4-7":   { input: 15, output: 75, cached_input: 1.50 }
};

// DeepSeek (via OpenRouter) — the default for Spark/Starter and the cheap
// router branches at higher tiers. Pricing is what OpenRouter charges us;
// DeepSeek-direct is similar but OpenRouter unifies billing/auth.
export const DEEPSEEK_PRICING = {
  "deepseek/deepseek-chat-v3-0324": { input: 0.27, output: 1.10, cached_input: 0.27 },
  "deepseek/deepseek-r1":           { input: 0.55, output: 2.19, cached_input: 0.55 }
};

// OpenAI Responses API (used on admin path via Sign-in-with-ChatGPT, or
// fallback when admin uses an OPENAI_API_KEY).
export const OPENAI_PRICING = {
  "gpt-5":      { input: 1.25, output: 10, cached_input: 0.13 },
  "gpt-5-mini": { input: 0.25, output: 2,  cached_input: 0.025 },
  "gpt-5-nano": { input: 0.05, output: 0.4, cached_input: 0.005 }
};

const ALL_PRICING = { ...ANTHROPIC_PRICING, ...DEEPSEEK_PRICING, ...OPENAI_PRICING };

// Compute USD cost in micros (1e-6 USD), integer for precision.
// Returns 0 for unknown models — caller should log a warning.
export function priceMicros({ model, input_tokens, cached_input_tokens, output_tokens }) {
  const p = ALL_PRICING[model];
  if (!p) return 0;
  const standardInput = Math.max(0, (input_tokens || 0) - (cached_input_tokens || 0));
  const cents =
    standardInput * (p.input / 1e6) +
    (cached_input_tokens || 0) * (p.cached_input / 1e6) +
    (output_tokens || 0) * (p.output / 1e6);
  return Math.round(cents * 1e6); // dollars → micros
}

// No free tier — every tier covers its own cost + leaves margin. Spark
// $5/mo is the entry: less than a coffee, filters for real intent, and
// even at 100% utilization on DeepSeek V3 nets ~$4.25 margin (85%).
//
// Cloud browser allowance is in minutes per month. 0 = no cloud browser
// at this tier (user can still use desktop app for free).
export const TIERS = {
  spark:   {
    allowance: 1_500_000,
    models: ["deepseek/deepseek-chat-v3-0324"],
    cloudMinutes: 0,
    priceMonthly: 5
  },
  starter: {
    allowance: 5_000_000,
    models: ["deepseek/deepseek-chat-v3-0324", "deepseek/deepseek-r1"],
    cloudMinutes: 30,
    priceMonthly: 19
  },
  pro: {
    allowance: 20_000_000,
    models: [
      "deepseek/deepseek-chat-v3-0324",
      "deepseek/deepseek-r1",
      "claude-haiku-4-5",
      "claude-sonnet-4-6"
    ],
    cloudMinutes: 8 * 60,
    priceMonthly: 89
  },
  studio: {
    allowance: 50_000_000,
    models: [
      "deepseek/deepseek-chat-v3-0324",
      "deepseek/deepseek-r1",
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
      "claude-opus-4-7"
    ],
    cloudMinutes: Number.POSITIVE_INFINITY,
    priceMonthly: 179
  },
  admin: {
    allowance: Number.POSITIVE_INFINITY,
    models: [
      "deepseek/deepseek-chat-v3-0324",
      "deepseek/deepseek-r1",
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
      "claude-opus-4-7",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano"
    ],
    cloudMinutes: Number.POSITIVE_INFINITY,
    priceMonthly: 0
  }
};

export const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days rolling

export function getTierConfig(tier) {
  return TIERS[tier] || TIERS.free;
}
