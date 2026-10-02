/**
 * Hedge Lab math. Pure functions, no AI: binary markets where each share pays
 * $1 if its side wins. A slip is a set of positions; positions on the same
 * market share one event, so they resolve together.
 */

export interface LabPosition {
  id: string;
  /** Polymarket id when it came from a real market; custom bets have none. */
  marketId: string | null;
  question: string;
  /** The two sides, in market order. */
  sides: [string, string];
  /** Which side you hold (0 or 1). */
  side: 0 | 1;
  stake: number;
  /** Price you bought at, 0–1. */
  entry: number;
  /** Current price of each side, 0–1. */
  now: [number, number];
  /** Money on the other side, bought at its current price (0 = no hedge). */
  hedge: number;
  /** Your own chance that your side wins, 0–1 (null = trust the market). */
  myOdds: number | null;
}

export const clampPrice = (p: number) => Math.min(0.99, Math.max(0.01, p));
const round2 = (x: number) => Math.round(x * 100) / 100;

export const shares = (p: LabPosition) => p.stake / clampPrice(p.entry);
export const otherPrice = (p: LabPosition) => clampPrice(p.now[1 - p.side]);
export const hedgeShares = (p: LabPosition) => p.hedge / otherPrice(p);
/** Money on the other side that makes both outcomes pay the same. */
export const fullLock = (p: LabPosition) => round2(shares(p) * otherPrice(p));

/** Profit if your side wins / loses, hedge included. */
export function outcomes(p: LabPosition) {
  const cost = p.stake + p.hedge;
  return { win: shares(p) - cost, lose: hedgeShares(p) - cost };
}

/** What the position (and its hedge) would sell for at today's prices. */
export const worthNow = (p: LabPosition) => shares(p) * clampPrice(p.now[p.side]) + hedgeShares(p) * otherPrice(p);

/** Market-implied chance that side `k` wins (prices normalised so they sum to 1). */
export function marketChance(p: LabPosition, k: 0 | 1) {
  const a = clampPrice(p.now[0]);
  const b = clampPrice(p.now[1]);
  return (k === 0 ? a : b) / (a + b);
}

/** One event per market (custom bets are their own event). */
export interface LabEvent {
  key: string;
  question: string;
  sides: [string, string];
  /** Chance side 0 wins, at market odds or your own. */
  p0: number;
  positions: LabPosition[];
}

export function events(slip: LabPosition[], useMine: boolean): LabEvent[] {
  const map = new Map<string, LabEvent>();
  for (const pos of slip) {
    const key = pos.marketId ?? pos.id;
    let ev = map.get(key);
    if (!ev) {
      ev = { key, question: pos.question, sides: pos.sides, p0: marketChance(pos, 0), positions: [] };
      map.set(key, ev);
    }
    // Your own odds (if you set them) override the market for that event.
    if (useMine && pos.myOdds != null) ev.p0 = pos.side === 0 ? pos.myOdds : 1 - pos.myOdds;
    ev.positions.push(pos);
  }
  return [...map.values()];
}

export const eventPnl = (ev: LabEvent, winner: 0 | 1) =>
  ev.positions.reduce((sum, p) => {
    const o = outcomes(p);
    return sum + (p.side === winner ? o.win : o.lose);
  }, 0);

export interface Scenario {
  /** Winning side per event, in event order. */
  winners: (0 | 1)[];
  chance: number;
  pnl: number;
}

/** Every way the slip can land (2^events, at most 16). */
export function scenarios(evs: LabEvent[]): Scenario[] {
  const out: Scenario[] = [];
  const n = evs.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const winners = evs.map((_, i) => ((mask >> i) & 1) as 0 | 1);
    let chance = 1;
    let pnl = 0;
    evs.forEach((ev, i) => {
      chance *= winners[i] === 0 ? ev.p0 : 1 - ev.p0;
      pnl += eventPnl(ev, winners[i]);
    });
    out.push({ winners, chance, pnl });
  }
  return out.sort((a, b) => b.pnl - a.pnl);
}

export function summary(slip: LabPosition[]) {
  const evs = events(slip, false);
  const sc = scenarios(evs);
  const staked = slip.reduce((s, p) => s + p.stake + p.hedge, 0);
  const worth = slip.reduce((s, p) => s + worthNow(p), 0);
  return {
    staked,
    worth,
    best: sc.length ? sc[0].pnl : 0,
    worst: sc.length ? sc[sc.length - 1].pnl : 0,
    /** Expected profit if the market's prices are right. */
    expected: sc.reduce((s, x) => s + x.chance * x.pnl, 0),
  };
}

/**
 * Kelly stake for buying a side at `price` when you think its chance is `mine`.
 * f* = (mine − price) / (1 − price). No edge → 0.
 */
export function kelly(mine: number, price: number) {
  const c = clampPrice(price);
  const f = (mine - c) / (1 - c);
  return Math.max(0, f);
}

/** Small seeded RNG so a run can be repeated exactly. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimResult {
  runs: number[];
  up: number;
  median: number;
  bad: number;
  good: number;
  wipe: number;
}

/** Play the slip out `n` times. */
export function simulate(evs: LabEvent[], n: number, seed: number, staked: number): SimResult {
  const r = rng(seed);
  const runs: number[] = [];
  for (let k = 0; k < n; k++) {
    let pnl = 0;
    for (const ev of evs) pnl += eventPnl(ev, r() < ev.p0 ? 0 : 1);
    runs.push(pnl);
  }
  const sorted = [...runs].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    runs,
    up: runs.filter((x) => x > 0.005).length / n,
    median: at(0.5),
    bad: at(0.1),
    good: at(0.9),
    wipe: staked > 0 ? runs.filter((x) => x <= -staked + 0.005).length / n : 0,
  };
}
