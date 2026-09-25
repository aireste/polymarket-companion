/**
 * Jev — the prediction engine.
 *
 * Jev (TypeSafe AI's "System One" model) is a calibrated DECISION model, not an
 * LLM: you hand it structured state plus typed questions and it returns choices,
 * probabilities, and a calibrated confidence directly. We route it through the
 * Vercel AI Gateway (model id `typesafe-ai/jev`).
 *
 * Division of labour: Jev makes the fast, calibrated call on the market's own
 * metrics; Claude (src/lib/recommend.ts) does the deeper, web-grounded read and
 * the human-language explanation. Jev does NOT browse the web — its probability
 * is a calibrated read of the numbers we give it.
 *
 * Auth: the Vercel AI SDK routes plain `provider/model` ids through the AI
 * Gateway and authenticates with `AI_GATEWAY_API_KEY`. We key off that env var
 * explicitly so the UI can show a clean "not configured" state.
 */

import { experimental_evaluate as evaluate } from "ai";
import type { Market } from "./polymarket";

const MODEL = "typesafe-ai/jev";

/** Thrown when the Vercel AI Gateway key isn't configured. Catch to fall back. */
export class MissingGatewayKeyError extends Error {
  constructor() {
    super(
      "No AI_GATEWAY_API_KEY configured. Set your Vercel AI Gateway key to enable Jev."
    );
    this.name = "MissingGatewayKeyError";
  }
}

export type JevAction = "wager" | "hold" | "skip";
export type JevValuation = "undervalued" | "fair" | "overvalued";

/** Jev's structured read on one market's leading outcome. */
export interface JevRead {
  /** The outcome this read is about (the first/leading outcome). */
  outcome: string;
  /** Market-implied probability for that outcome, in [0,1]. */
  marketPrice: number;
  /** Jev's calibrated P(outcome resolves YES), in [0,1]. */
  probability: number;
  /** probability - marketPrice, in probability points. */
  edge: number;
  /** Jev's action: wager / hold / skip. */
  action: JevAction;
  /** Full distribution over the actions, when Jev supplies one. */
  actionProbabilities?: Record<string, number>;
  /** Derived from edge: is the outcome under/over/fairly priced? */
  valuation: JevValuation;
  /** Jev's calibrated confidence in the action, in [0,1]; null if not returned. */
  confidence: number | null;
  model: string;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const usd = (x: number) => `$${Math.round(x).toLocaleString()}`;

/** Compact, typed description of the market for Jev to evaluate. */
function buildState(market: Market): string {
  const target = market.outcomes[0];
  const odds = market.outcomes
    .map((o) => `${o.label}: ${(o.price * 100).toFixed(1)}% implied`)
    .join(" | ");
  const when = market.gameStartTime
    ? `game starts ${market.gameStartTime.toISOString()}`
    : market.endDate
      ? `resolves by ${market.endDate.toISOString().slice(0, 10)}`
      : "open-ended";
  return [
    `Prediction market: "${market.question}"`,
    `Outcomes (market-implied probabilities): ${odds}`,
    `Leading outcome under review: "${target?.label}" at ${(target?.price ?? 0) * 100}%`,
    `24h volume: ${usd(market.volume24hr)} | order-book liquidity: ${usd(market.liquidity)} | ${when}`,
    `A market's price already reflects the crowd's probability. Only diverge from it when the metrics give a concrete reason.`,
  ].join("\n");
}

/**
 * Ask Jev for a calibrated read on a market's leading outcome.
 * Throws MissingGatewayKeyError when the gateway key isn't configured.
 */
export async function jevRead(market: Market): Promise<JevRead> {
  if (!process.env.AI_GATEWAY_API_KEY) throw new MissingGatewayKeyError();

  const target = market.outcomes[0];
  if (!target) throw new Error("Market has no outcomes to evaluate.");

  const result = await evaluate({
    model: MODEL,
    state: buildState(market),
    questions: {
      outcome: {
        type: "boolean",
        instructions: `Will the outcome "${target.label}" resolve YES (win)?`,
        criteria: {
          true: `"${target.label}" is the more likely result given the metrics.`,
          false: `"${target.label}" is unlikely to win.`,
        },
      },
      call: {
        type: "choice",
        instructions:
          "Given the market metrics, what is the play on the leading outcome right now?",
        criteria: {
          wager: "Clear, actionable value worth acting on now.",
          hold: "Some edge, but small or the timing is uncertain; wait.",
          skip: "The market looks efficient, there is no edge, or it is too risky.",
        },
      },
    },
  });

  const probability = clamp01(result.answers.outcome.probability);
  const action = result.answers.call.choice as JevAction;
  const edge = probability - target.price;
  const valuation: JevValuation =
    edge > 0.02 ? "undervalued" : edge < -0.02 ? "overvalued" : "fair";

  // Jev returns calibrated confidence for choice/score questions here.
  const conf = result.providerMetadata?.typesafe?.confidence as
    | Record<string, number>
    | undefined;

  return {
    outcome: target.label,
    marketPrice: target.price,
    probability,
    edge,
    action,
    actionProbabilities: result.answers.call.probabilities,
    valuation,
    confidence: typeof conf?.call === "number" ? conf.call : null,
    model: MODEL,
  };
}
