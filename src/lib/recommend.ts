/**
 * HedgePredict V2 — autonomous recommendation engine.
 *
 * No sliders. Given a market, Claude checks live news/sentiment via web search,
 * estimates the true probability, compares it to the market, and returns a
 * strict, structured recommendation: CHASE / HOLD / SKIP + grounded sentiment
 * + rationale. Honest by construction: efficient markets get HOLD or SKIP.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Market } from "./polymarket";
import { MissingCredentialsError } from "./read";

export type AiAction = "CHASE" | "HOLD" | "SKIP";

export interface Recommendation {
  /** Claude's estimated probability for the first outcome, in [0,1]. */
  probability: number;
  action: AiAction;
  confidence: "low" | "medium" | "high";
  /** Grounded 1-2 sentence crowd/news sentiment summary. */
  sentiment: string;
  /** Why this action. */
  rationale: string;
  model: string;
}

const MODEL = "claude-opus-4-8";

const REC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    probability: {
      type: "number",
      description:
        "Your estimated probability (0 to 1) that the FIRST outcome resolves YES.",
    },
    action: {
      type: "string",
      enum: ["CHASE", "HOLD", "SKIP"],
      description:
        "CHASE = clear positive value worth acting on now; HOLD = some edge but wait/uncertain; SKIP = market looks efficient, no edge, or too risky.",
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    sentiment: {
      type: "string",
      description:
        "1-2 sentences on current crowd/news sentiment, grounded in your web search. Say 'No notable recent chatter.' if you find none.",
    },
    rationale: {
      type: "string",
      description:
        "1-2 sentences on why this action, referencing the edge vs the market price and the sentiment. No filler.",
    },
  },
  required: ["probability", "action", "confidence", "sentiment", "rationale"],
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Produce an automated recommendation for a market.
 * Throws MissingCredentialsError when no Anthropic key is configured.
 */
export async function recommend(market: Market): Promise<Recommendation> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingCredentialsError();

  const target = market.outcomes[0];
  const client = new Anthropic();

  const odds = market.outcomes
    .map((o) => `${o.label}: ${(o.price * 100).toFixed(1)}%`)
    .join(" · ");
  const endText = market.endDate
    ? market.endDate.toISOString().slice(0, 10)
    : "open-ended";
  const targetPct = target ? (target.price * 100).toFixed(1) : "?";

  const prompt = `You are a calibrated prediction-market analyst for HedgePredict. A market price already reflects the crowd's probability, so only call value when you have a concrete reason.

Market: "${market.question}"
Market-implied odds: ${odds}
Resolves by: ${endText} · 24h volume $${Math.round(market.volume24hr).toLocaleString()} · liquidity $${Math.round(market.liquidity).toLocaleString()}

Do this:
1. Use web search to check the most recent news and social sentiment relevant to this market.
2. Estimate the true probability that the FIRST outcome ("${target?.label}") resolves YES. The market implies ${targetPct}%.
3. Compare your estimate to the market price and choose an action:
   - CHASE: you see a clear, actionable edge worth acting on now.
   - HOLD: some edge but small, or the timing/read is uncertain.
   - SKIP: the market looks efficient, you have no edge, or it's too risky.
Most efficient markets should be HOLD or SKIP. Ground the sentiment summary in what you actually find; do not invent chatter.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    thinking: { type: "adaptive" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: REC_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  // The final structured answer is the last text block.
  const textBlock = [...response.content]
    .reverse()
    .find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      `No structured recommendation returned (stop_reason: ${response.stop_reason}).`
    );
  }
  const parsed = JSON.parse(textBlock.text) as {
    probability: number;
    action: AiAction;
    confidence: "low" | "medium" | "high";
    sentiment: string;
    rationale: string;
  };

  return {
    probability: clamp01(parsed.probability),
    action: parsed.action,
    confidence: parsed.confidence,
    sentiment: parsed.sentiment,
    rationale: parsed.rationale,
    model: response.model,
  };
}
