/**
 * The LLM "read" layer — the third leg of the API + LLM + MCP trifecta.
 *
 * A market price already IS the crowd's probability estimate, so the honest
 * job here is NOT to invent a "true" number. It's to have Claude reason about
 * the market as a thought partner — treat the market price as the prior, then
 * say where (and why) an informed read might differ, with an explicit
 * confidence level. That estimate feeds `analyzePlay` in scoring.ts to produce
 * a sized, hedged play.
 *
 * Degrades gracefully: if no Anthropic credentials are configured, this throws
 * a typed `MissingCredentialsError` so callers can fall back to a manual read
 * instead of crashing.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Market } from "./polymarket";

/** Thrown when no Anthropic API key / auth is available. Catch to fall back. */
export class MissingCredentialsError extends Error {
  constructor() {
    super(
      "No Anthropic credentials found. Set ANTHROPIC_API_KEY to enable AI reads; " +
        "until then, enter your own probability estimate manually."
    );
    this.name = "MissingCredentialsError";
  }
}

/** Claude's probability read for one outcome of a market. */
export interface Read {
  /** The outcome this read is about (e.g. "Yes"). */
  outcome: string;
  /** Market's current implied probability for that outcome, in [0,1]. */
  marketPrice: number;
  /** Claude's estimated probability for that outcome, in [0,1]. */
  probability: number;
  confidence: "low" | "medium" | "high";
  /** One or two sentences: why this differs from (or agrees with) the market. */
  rationale: string;
  /** Which model produced the read, for transparency in the UI. */
  model: string;
}

const MODEL = "claude-opus-4-8";

/** JSON shape we constrain Claude's output to (structured outputs). */
const READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    probability: {
      type: "number",
      description: "Your estimated probability (0 to 1) that the outcome resolves YES.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "How confident you are in this estimate relative to the market.",
    },
    rationale: {
      type: "string",
      description:
        "One or two sentences on why your estimate differs from or agrees with the market price. Be concrete; no hedging filler.",
    },
  },
  required: ["probability", "confidence", "rationale"],
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Ask Claude for a probability read on a market's leading outcome.
 * Throws MissingCredentialsError if no credentials are configured.
 */
export async function generateRead(market: Market): Promise<Read> {
  // The SDK also resolves an `ant` login profile, but in this app we key off
  // the env var explicitly so the UI can show a clear "add a key" state.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingCredentialsError();
  }

  const target = market.outcomes[0];
  const client = new Anthropic();

  const outcomeLines = market.outcomes
    .map((o) => `- ${o.label}: market implies ${(o.price * 100).toFixed(1)}%`)
    .join("\n");

  const endText = market.endDate
    ? market.endDate.toISOString().slice(0, 10)
    : "unknown";

  const prompt = `You are a calibrated prediction-market analyst. A market's price already reflects the crowd's probability estimate, so only deviate from it when you have a concrete reason. Estimate the probability that the FIRST outcome resolves YES.

Market: "${market.question}"
Outcomes and current market-implied probabilities:
${outcomeLines}

Resolves by: ${endText}
24h volume: $${Math.round(market.volume24hr).toLocaleString()} | liquidity: $${Math.round(market.liquidity).toLocaleString()}

Estimate the probability that "${target.label}" resolves YES. The market implies ${(target.price * 100).toFixed(1)}%. If you have no informational edge, return the market price and mark confidence "low".`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: READ_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  // Structured outputs guarantee a single valid-JSON text block.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no structured read.");
  }
  const parsed = JSON.parse(textBlock.text) as {
    probability: number;
    confidence: "low" | "medium" | "high";
    rationale: string;
  };

  return {
    outcome: target.label,
    marketPrice: target.price,
    probability: clamp01(parsed.probability),
    confidence: parsed.confidence,
    rationale: parsed.rationale,
    model: response.model,
  };
}
