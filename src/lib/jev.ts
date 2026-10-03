/**
 * Jev — the prediction engine.
 *
 * Jev (TypeSafe AI's "System One" model) is a calibrated DECISION model, not an
 * LLM: you hand it structured state plus typed questions and it returns choices,
 * probabilities, and a calibrated confidence directly. We call TypeSafe's API
 * directly via `@typesafe-ai/sdk` (model `jev-latest`).
 *
 * What we ask (2026-09-30): "At these prices, is either side underpriced?" as
 * a Choice over [each outcome, neither]. That is a judgement relative to the
 * price, which Jev answers coherently. We deliberately do NOT ask Jev for a raw
 * "will X happen?" probability and present it as a fair price: measured on the
 * live board it sat below the market on 15 of 18 markets regardless of side,
 * and pointed the opposite way to Jev's own lean on 6 of 9 leans.
 *
 * The wager / hold / skip call is a rule in code over Jev's distribution (see
 * `callFrom`), so the call always matches the numbers shown next to it.
 *
 * Division of labour: Jev makes the fast call from the market's own numbers
 * (price, 7-day and 1-day move, volume, timing). Claude (src/lib/recommend.ts)
 * does the deeper, web-grounded read. Jev does NOT browse the web.
 */

import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { activityText, type Market } from "./polymarket";
import type { JevReadDTO } from "./dto";
import { fetchHistory } from "./history";

const MODEL = "jev-latest";

/** Thrown when the TypeSafe key isn't configured. Catch to fall back. */
export class MissingJevKeyError extends Error {
  constructor() {
    super("No TYPESAFE_API_KEY configured. Set your TypeSafe key to enable Jev.");
    this.name = "MissingJevKeyError";
  }
}

let client: TypeSafeClient | null = null;
const getClient = () => (client ??= new TypeSafeClient());

export type JevAction = "wager" | "hold" | "skip";

/** Jev's read on one market: which side (if any) looks underpriced, and how strongly. */
export interface JevRead {
  /** The market's outcomes with their current prices, in [0,1]. */
  sides: { label: string; price: number }[];
  /** Index into `sides` of the side Jev leans toward; null = priced about right. */
  lean: number | null;
  /** Jev's probability on its answer: the leaned side, or "neither" on a skip. */
  strength: number;
  /** Jev's full distribution: one entry per side, plus "neither". */
  distribution: { sides: number[]; neither: number };
  action: JevAction;
  /** Calibrated confidence in the answer, [0,1]; null if not returned. */
  confidence: number | null;
  /** One side is already at >= 97%: effectively decided, so Jev makes no call. */
  settled: boolean;
  model: string;
}

/** Past this price a market is effectively decided (e.g. a game that's over). */
export const SETTLED_AT = 0.97;

/** Thresholds for the call. Wager = Jev picks a side outright; hold = a clear lean. */
export const WAGER_AT = 0.5;
export const LEAN_AT = 0.25;
const LEAN_MARGIN = 1.5; // the lean must beat the next side by this factor

/** The call as a rule over Jev's distribution, so it can never contradict it. */
export function callFrom(sideProbs: number[]): { action: JevAction; lean: number | null } {
  const order = sideProbs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  const [top, topIdx] = order[0] ?? [0, 0];
  const second = order[1]?.[0] ?? 0;
  if (top >= WAGER_AT) return { action: "wager", lean: topIdx };
  if (top >= LEAN_AT && top >= second * LEAN_MARGIN) return { action: "hold", lean: topIdx };
  return { action: "skip", lean: null };
}

const pts = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} pts`;

/** How the first outcome's price moved over 7 days and the last day (best effort). */
async function priceMove(market: Market): Promise<string | null> {
  const token = market.outcomes[0]?.tokenId;
  if (!token) return null;
  try {
    const h = await fetchHistory(token, "1w");
    if (h.length < 2) return null;
    const last = h[h.length - 1].p;
    const dayAgo = h.length > 8 ? h[h.length - 9].p : h[0].p; // 1w series is ~3h apart
    return `"${market.outcomes[0].label}" moved ${pts(last - h[0].p)} over 7 days, ${pts(last - dayAgo)} over the last day`;
  } catch {
    return null;
  }
}

/** Named JSON fields, per TypeSafe's state guidance. */
async function buildState(market: Market) {
  const prices = Object.fromEntries(market.outcomes.map((o) => [o.label, `${(o.price * 100).toFixed(1)}%`]));
  const move = await priceMove(market);
  return {
    market: market.question,
    prices,
    ...(move ? { price_move: move } : {}),
    activity: activityText(market),
    timing: market.gameStartTime
      ? `game starts ${market.gameStartTime.toISOString()}`
      : market.endDate
        ? `resolves by ${market.endDate.toISOString().slice(0, 10)}`
        : "open-ended",
  };
}

/**
 * Ask Jev whether either side of a market is underpriced right now.
 * Throws MissingJevKeyError when the TypeSafe key isn't configured.
 */
export async function jevRead(market: Market): Promise<JevRead> {
  if (!process.env.TYPESAFE_API_KEY) throw new MissingJevKeyError();
  if (market.outcomes.length < 2) throw new Error("Market needs at least two outcomes.");

  const sides = market.outcomes.map((o) => ({ label: o.label, price: o.price }));
  // A decided market has no real call to make, and asking would invite nonsense
  // like "the 0% side is underpriced" on a finished game. Skip the request.
  if (sides.some((s) => s.price >= SETTLED_AT)) {
    return {
      sides,
      lean: null,
      strength: 1,
      distribution: { sides: sides.map(() => 0), neither: 1 },
      action: "skip",
      confidence: null,
      settled: true,
      model: MODEL,
    };
  }
  const options: Record<string, string> = {};
  sides.forEach((s, i) => {
    options[`s${i}`] = `"${s.label}" is underpriced: its real chance is higher than ${Math.round(s.price * 100)}%.`;
  });
  options.neither = "Neither: the prices look about right.";

  const result = await getClient().systemOne({
    model: MODEL,
    state: await buildState(market),
    questions: {
      side: choice("Using everything you know about this event, is either side underpriced at these prices?", options),
    },
  });

  const answer = result.answers.side;
  const probs = answer.probabilities as Record<string, number>;
  const sideProbs = sides.map((_, i) => probs[`s${i}`] ?? 0);
  const neither = probs.neither ?? 0;
  const { action, lean } = callFrom(sideProbs);

  return {
    sides,
    lean,
    strength: lean == null ? neither : sideProbs[lean],
    distribution: { sides: sideProbs, neither },
    action,
    confidence: typeof answer.confidence === "number" ? answer.confidence : null,
    settled: false,
    model: result.model,
  };
}

/** Serialize a read for the client (the /api/jev response shape). */
export function toJevDTO(market: Market, jev: JevRead): JevReadDTO {
  return {
    marketId: market.id,
    marketName: market.question,
    sides: jev.sides,
    lean: jev.lean,
    strength: jev.strength,
    distribution: jev.distribution,
    action: jev.action,
    confidence: jev.confidence,
    settled: jev.settled,
    model: jev.model,
  };
}

/** One plain line for tools and chat: "Jev leans Colts (54%)" / "Jev: priced about right". */
export function describeRead(jev: Pick<JevRead, "sides" | "lean" | "strength" | "action" | "settled">): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (jev.settled) return "No call: this market is effectively decided (one side is at 97% or more)";
  if (jev.lean == null) return `Skip: both prices look fair (Jev is ${pct(jev.strength)} sure)`;
  const side = jev.sides[jev.lean];
  const verb = jev.action === "wager" ? "Wager" : "Lean";
  const cents = `${Math.max(1, Math.min(99, Math.round(side.price * 100)))}¢`;
  return `${verb}: ${side.label} looks too cheap at ${cents} (Jev is ${pct(jev.strength)} sure; that's confidence, not a win chance)`;
}
