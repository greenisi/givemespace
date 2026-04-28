// Anthropic + OpenAI pricing as of April 2026 (verify monthly — pricing changes).
// All prices are USD per million tokens (MTok). Stored cost in DB is micros.

export const ANTHROPIC_PRICING = {
  "claude-haiku-4-5":  { input: 1,  output: 5,  cached_input: 0.10 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cached_input: 0.30 },
  "claude-opus-4-7":   { input: 15, output: 75, cached_input: 1.50 }
};

// OpenAI Responses API (used on admin path via Sign-in-with-ChatGPT).
// When admin is on the ChatGPT-OAuth subscription path, $0 is billed to us;
// these prices are the API fallback when OAuth is unavailable.
export const OPENAI_PRICING = {
  "gpt-5":      { input: 1.25, output: 10, cached_input: 0.13 },
  "gpt-5-mini": { input: 0.25, output: 2,  cached_input: 0.025 },
  "gpt-5-nano": { input: 0.05, output: 0.4, cached_input: 0.005 }
};

const ALL_PRICING = { ...ANTHROPIC_PRICING, ...OPENAI_PRICING };

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

export const TIERS = {
  free:    { allowance: 100_000,    models: ["claude-haiku-4-5"],                                                 priceMonthly: 0   },
  starter: { allowance: 5_000_000,  models: ["claude-haiku-4-5", "claude-sonnet-4-6"],                            priceMonthly: 19  },
  pro:     { allowance: 20_000_000, models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],         priceMonthly: 89  },
  studio:  { allowance: 50_000_000, models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],         priceMonthly: 179 },
  admin:   { allowance: Number.POSITIVE_INFINITY, models: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"], priceMonthly: 0 }
};

export const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days rolling

export function getTierConfig(tier) {
  return TIERS[tier] || TIERS.free;
}
