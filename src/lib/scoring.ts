/**
 * HedgePredict scoring engine.
 *
 * Two independent halves, deliberately kept apart:
 *
 *  1. rankMarkets()  — SIGNAL layer. Ranks live markets on observable facts
 *     (momentum, liquidity, uncertainty, timeliness). Makes NO claim about
 *     "true odds"; it only answers "what's worth a look right now?".
 *
 *  2. analyzePlay()  — EDGE layer. Given a market price and YOUR probability
 *     read, computes edge, a fractional-Kelly stake, and a hedge leg. Every
 *     number here traces back to a stated belief — no invented truth.
 *
 * This is a decision-support tool, not financial advice, and it does not place
 * trades. Suggested stakes are fractional-Kelly and clamped for safety.
 */

import type { Market, Outcome } from "./polymarket";

/* ------------------------------------------------------------------ */
/* 1. SIGNAL LAYER — rank what's worth looking at                     */
/* ------------------------------------------------------------------ */

export interface Signals {
  /** Trailing 24h volume, normalized 0..1 across the set. Heat. */
  momentum: number;
  /** Order-book liquidity, normalized 0..1. Can you actually get filled? */
  liquidity: number;
  /** Normalized entropy of outcome prices 0..1. 1 = maximally uncertain. */
  uncertainty: number;
  /** Sooner resolution scores higher, normalized 0..1. Faster payoff. */
  timeliness: number;
}

export interface ScoredMarket extends Market {
  score: number;
  signals: Signals;
}

export interface RankWeights {
  momentum: number;
  liquidity: number;
  uncertainty: number;
  timeliness: number;
}

export const DEFAULT_WEIGHTS: RankWeights = {
  momentum: 0.35,
  liquidity: 0.25,
  uncertainty: 0.25,
  timeliness: 0.15,
};

/** Shannon entropy of the price vector, normalized to 0..1 by log(n). */
function priceEntropy(outcomes: Outcome[]): number {
  const ps = outcomes.map((o) => o.price).filter((p) => p > 0 && p <= 1);
  if (ps.length < 2) return 0;
  // Prices sum to ~1 already, but renormalize defensively.
  const total = ps.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const norm = ps.map((p) => p / total);
  const h = -norm.reduce((acc, p) => acc + (p > 0 ? p * Math.log(p) : 0), 0);
  return h / Math.log(norm.length); // divide by max entropy
}

/** Days until resolution; large sentinel if unknown/past so it scores low. */
function daysToResolution(m: Market, now: Date): number {
  if (!m.endDate) return 3650;
  const days = (m.endDate.getTime() - now.getTime()) / 86_400_000;
  return days < 0 ? 3650 : days;
}

/** Min-max normalize an array to 0..1; all-equal -> all 0.5. */
function normalizeSet(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return values.map(() => 0.5);
  }
  return values.map((v) => (v - min) / (max - min));
}

export interface RankOptions {
  weights?: Partial<RankWeights>;
  /** Drop markets thinner than this (USD liquidity). Default 500. */
  minLiquidity?: number;
  /** Return at most this many. Default 20. */
  limit?: number;
  now?: Date;
}

/**
 * Rank markets by a weighted blend of normalized signals.
 * Signals are normalized ACROSS the provided set, so this reflects
 * "best among what you fetched", not an absolute rating.
 */
export function rankMarkets(
  markets: Market[],
  opts: RankOptions = {}
): ScoredMarket[] {
  const weights = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const minLiquidity = opts.minLiquidity ?? 500;
  const limit = opts.limit ?? 20;
  const now = opts.now ?? new Date();

  const pool = markets.filter((m) => m.liquidity >= minLiquidity);
  if (pool.length === 0) return [];

  // Log-scale the heavy-tailed dollar figures before normalizing.
  const momentumRaw = normalizeSet(pool.map((m) => Math.log1p(m.volume24hr)));
  const liquidityRaw = normalizeSet(pool.map((m) => Math.log1p(m.liquidity)));
  const uncertaintyRaw = pool.map((m) => priceEntropy(m.outcomes));
  // Timeliness: invert days-to-resolution (sooner = higher) then normalize.
  const timelinessRaw = normalizeSet(
    pool.map((m) => -Math.log1p(daysToResolution(m, now)))
  );

  const wSum =
    weights.momentum +
    weights.liquidity +
    weights.uncertainty +
    weights.timeliness || 1;

  const scored: ScoredMarket[] = pool.map((m, i) => {
    const signals: Signals = {
      momentum: momentumRaw[i],
      liquidity: liquidityRaw[i],
      uncertainty: uncertaintyRaw[i],
      timeliness: timelinessRaw[i],
    };
    const score =
      (weights.momentum * signals.momentum +
        weights.liquidity * signals.liquidity +
        weights.uncertainty * signals.uncertainty +
        weights.timeliness * signals.timeliness) /
      wSum;
    return { ...m, score, signals };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 2. EDGE LAYER — turn a probability read into a sized play          */
/* ------------------------------------------------------------------ */

export interface PlayInput {
  /** Market's current price for the outcome you're eyeing, in (0,1). */
  marketPrice: number;
  /** YOUR probability that this outcome resolves YES, in (0,1). */
  yourProbability: number;
  /** Total bankroll you'd risk across plays, USD. */
  bankroll: number;
  /** Kelly fraction for safety. Default 0.25 (quarter-Kelly). */
  kellyFraction?: number;
}

export interface PlayAnalysis {
  /** yourProbability - marketPrice, in probability points. */
  edge: number;
  /** Percentage points, human-friendly (edge * 100). */
  edgePoints: number;
  /** "buy" if you have positive edge on this outcome, else "avoid". */
  verdict: "buy" | "avoid";
  /** Full-Kelly fraction of bankroll (can be negative). */
  fullKelly: number;
  /** Suggested stake after applying kellyFraction & clamping, USD. */
  suggestedStake: number;
  /** Expected value per $1 staked at this price & your read. */
  evPerDollar: number;
  /** The opposing side you'd buy to hedge, with its implied price. */
  hedge: {
    opposingPrice: number;
    /** Stake on the opposing side to lock a guaranteed outcome, USD. */
    stakeToLock: number;
    note: string;
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Compute edge, fractional-Kelly stake, and a hedge leg for one outcome.
 * Throws on nonsensical inputs so the caller surfaces a clean error.
 */
export function analyzePlay(input: PlayInput): PlayAnalysis {
  const { marketPrice, yourProbability, bankroll } = input;
  const kellyFraction = input.kellyFraction ?? 0.25;

  if (!(marketPrice > 0 && marketPrice < 1)) {
    throw new Error("marketPrice must be strictly between 0 and 1");
  }
  if (!(yourProbability > 0 && yourProbability < 1)) {
    throw new Error("yourProbability must be strictly between 0 and 1");
  }
  if (!(bankroll >= 0)) {
    throw new Error("bankroll must be >= 0");
  }

  const c = marketPrice; // cost per share
  const p = yourProbability; // your P(win)
  const q = 1 - p;
  const b = (1 - c) / c; // net odds: profit per $1 staked if win

  const edge = p - c;
  // Kelly for a bet at decimal odds b: f* = (b*p - q) / b
  const fullKelly = (b * p - q) / b;
  const evPerDollar = p * b - q; // expected profit per $1 staked

  const verdict: "buy" | "avoid" = edge > 0 ? "buy" : "avoid";

  // Only stake when there's positive edge; fractional-Kelly, clamped to [0,1].
  const sizedFraction = clamp01(Math.max(0, fullKelly) * kellyFraction);
  const suggestedStake = verdict === "buy" ? bankroll * sizedFraction : 0;

  const opposingPrice = 1 - c;
  // To fully lock: match share counts on both sides. Shares from primary
  // stake = suggestedStake / c; cost to buy equal shares of the other side:
  const stakeToLock =
    suggestedStake > 0 ? (suggestedStake / c) * opposingPrice : 0;

  return {
    edge,
    edgePoints: edge * 100,
    verdict,
    fullKelly,
    suggestedStake: Math.round(suggestedStake * 100) / 100,
    evPerDollar,
    hedge: {
      opposingPrice,
      stakeToLock: Math.round(stakeToLock * 100) / 100,
      note:
        verdict === "buy"
          ? `Buying the opposing side at ${(opposingPrice * 100).toFixed(1)}% for $${(Math.round(stakeToLock * 100) / 100).toFixed(2)} locks equal shares both ways — caps downside, floors upside.`
          : "No positive edge on this outcome at your read, so no stake and nothing to hedge.",
    },
  };
}
