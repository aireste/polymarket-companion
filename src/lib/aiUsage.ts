/**
 * What every Anthropic call costs, written to the `ai_usage` table so "where did the credits go?"
 * has an answer in dollars per feature per day (`npm run ai:cost`).
 *
 * Cost is worked out from the tokens and web searches the API reports for each call, at the list
 * prices below (USD per million tokens; a web search is $10 per 1,000). Search results are billed
 * as input tokens, which is why a searched call costs far more than its prompt suggests.
 */
const PRICES: { match: string; input: number; output: number; cacheRead: number }[] = [
  { match: "claude-sonnet-5", input: 2, output: 10, cacheRead: 0.2 },
  { match: "claude-opus-5-5", input: 4, output: 20, cacheRead: 0.2 },
  { match: "claude-opus", input: 5, output: 25, cacheRead: 0.5 },
];
const PER_SEARCH = 0.01;
const CACHE_WRITE = 1.25; // x input price (5-minute cache)

interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** Dollars for one call, or null for a model whose price isn't listed here. */
export function costOf(model: string, u: Usage): number | null {
  const p = PRICES.find((x) => model.startsWith(x.match));
  if (!p) return null;
  const M = 1_000_000;
  return (
    ((u.input_tokens ?? 0) * p.input) / M +
    ((u.output_tokens ?? 0) * p.output) / M +
    ((u.cache_read_input_tokens ?? 0) * p.cacheRead) / M +
    ((u.cache_creation_input_tokens ?? 0) * p.input * CACHE_WRITE) / M +
    (u.server_tool_use?.web_search_requests ?? 0) * PER_SEARCH
  );
}

/**
 * Record one call. `feature` is what the money bought: "daily-news", "daily-writer", "ask",
 * "explain", "deep-read", "read". Never throws: a logging failure must not break the feature.
 */
export async function logUsage(feature: string, message: { model: string; usage: Usage }): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { db } = await import("@/db");
    const { aiUsage } = await import("@/db/schema");
    const u = message.usage;
    await db.insert(aiUsage).values({
      feature,
      model: message.model,
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      webSearches: u.server_tool_use?.web_search_requests ?? 0,
      costUsd: costOf(message.model, u),
    });
  } catch {
    /* not worth failing a request over */
  }
}
