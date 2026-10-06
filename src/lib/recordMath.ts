/**
 * The scorecard's arithmetic, kept free of the database so the page can recompute it in the
 * browser when someone filters by call. Everything is derived from the list of calls.
 *
 * The record answers one question: did HedgePredict call it right BEFORE the event? So it counts
 * calls made before a game started and calls on markets that aren't games (futures, elections).
 * Calls made during a live game are reported separately and never mixed in. Calls made before the
 * switch to Polymarket US (international prices, different model inputs) are listed, not counted.
 */

export interface RecordCall {
  id: number;
  loggedAt: string;
  resolvedAt: string | null;
  question: string;
  call: "Wager" | "Lean";
  side: string;
  sidePrice: number;
  howSure: number;
  result: "open" | "won" | "lost" | "void";
  profit: number | null;
  /** Made before the switch to Polymarket US: listed, not counted. */
  early: boolean;
  /** When the call was made: before a game started, while it was being played, or on a market with no game. */
  timing: "pre-game" | "live" | "other";
}

export interface RecordLine {
  label: string;
  logged: number;
  resolved: number;
  won: number;
  lost: number;
  /** Share of resolved calls that won. */
  hitRate: number | null;
  /** Average price paid on resolved calls: the hit rate needed just to break even. */
  breakEven: number | null;
  /** Profit per $1 staked, flat $1 on every resolved call. */
  perDollar: number | null;
  profit: number;
}

export type CallFilter = "all" | "Wager" | "Lean";

/** One resolved call on the charts, in the order the calls were made. */
export interface CurvePoint {
  n: number;
  t: number;
  /** Running profit after this call. */
  v: number;
  question: string;
  call: string;
  side: string;
  price: number;
  won: boolean;
  profit: number;
}

export interface RecordView {
  since: string | null;
  all: RecordLine;
  byCall: RecordLine[];
  bySure: RecordLine[];
  byTiming: RecordLine[];
  /** Calls grouped by the price paid, to compare how often they won with how often they had to. */
  byPrice: RecordLine[];
  live: { all: RecordLine; byCall: RecordLine[] };
  curve: CurvePoint[];
  /** How much of the total rests on a couple of results. */
  topWins: { names: string[]; sum: number; without: number } | null;
  /** The calls this view lists (the filter applied), newest first. */
  calls: RecordCall[];
  earlyCount: number;
}

export function line(label: string, rows: RecordCall[]): RecordLine {
  const done = rows.filter((r) => r.result === "won" || r.result === "lost");
  const won = done.filter((r) => r.result === "won").length;
  const profit = done.reduce((s, r) => s + (r.profit ?? 0), 0);
  return {
    label,
    logged: rows.length,
    resolved: done.length,
    won,
    lost: done.length - won,
    hitRate: done.length ? won / done.length : null,
    breakEven: done.length ? done.reduce((s, r) => s + r.sidePrice, 0) / done.length : null,
    perDollar: done.length ? profit / done.length : null,
    profit,
  };
}

const PRICE_BANDS: [string, number, number][] = [
  ["Under 20¢", 0, 0.2],
  ["20 to 40¢", 0.2, 0.4],
  ["40 to 60¢", 0.4, 0.6],
  ["60 to 80¢", 0.6, 0.8],
  ["80¢ and up", 0.8, 2],
];

export function buildRecord(allCalls: RecordCall[], filter: CallFilter): RecordView {
  const calls = filter === "all" ? allCalls : allCalls.filter((c) => c.call === filter);
  const us = calls.filter((c) => !c.early);
  const counted = us.filter((c) => c.timing !== "live");
  const inGame = us.filter((c) => c.timing === "live");
  const done = counted
    .filter((c) => c.result === "won" || c.result === "lost")
    .sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt) || a.id - b.id);
  let run = 0;
  const curve: CurvePoint[] = done.map((c, i) => {
    run += c.profit ?? 0;
    return { n: i + 1, t: Date.parse(c.loggedAt), v: run, question: c.question, call: c.call, side: c.side, price: c.sidePrice, won: c.result === "won", profit: c.profit ?? 0 };
  });
  const wins = done.filter((c) => (c.profit ?? 0) > 0).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).slice(0, 2);
  const topSum = wins.reduce((s, c) => s + (c.profit ?? 0), 0);
  const band = (lo: number, hi: number) => counted.filter((c) => c.howSure >= lo && c.howSure < hi);
  return {
    since: counted.length ? counted.reduce((m, c) => (c.loggedAt < m ? c.loggedAt : m), counted[0].loggedAt) : null,
    all: line(filter === "all" ? "All calls" : `All ${filter}s`, counted),
    byCall: [line("Wager", counted.filter((c) => c.call === "Wager")), line("Lean", counted.filter((c) => c.call === "Lean"))],
    bySure: [line("Under 35% sure", band(0, 0.35)), line("35 to 50% sure", band(0.35, 0.5)), line("50% sure or more", band(0.5, 2))],
    byTiming: [
      line("Games, called before kickoff", counted.filter((c) => c.timing === "pre-game")),
      line("Futures, elections and other", counted.filter((c) => c.timing === "other")),
    ],
    byPrice: PRICE_BANDS.map(([label, lo, hi]) => line(label, counted.filter((c) => c.sidePrice >= lo && c.sidePrice < hi))),
    live: {
      all: line("All in-game calls", inGame),
      byCall: [line("Wager", inGame.filter((c) => c.call === "Wager")), line("Lean", inGame.filter((c) => c.call === "Lean"))],
    },
    curve,
    topWins: done.length >= 5 && wins.length === 2 ? { names: wins.map((c) => `${c.side} at ${Math.round(c.sidePrice * 100)}¢`), sum: topSum, without: run - topSum } : null,
    calls,
    earlyCount: calls.filter((c) => c.early).length,
  };
}

/** "If you'd followed every Wager / Lean": the record and the money at a flat $1 a call. */
export interface FollowLine {
  call: "Wager" | "Lean";
  won: number;
  lost: number;
  /** Profit at a flat $1 on every resolved call. */
  profit: number;
  /** $ staked on resolved calls (one per call). */
  staked: number;
  /** Calls still waiting on their market. */
  open: number;
}

/** Counted calls only (Polymarket US, made before the game), same as the rest of the scorecard. */
export function followSummary(allCalls: RecordCall[]): { lines: FollowLine[]; resolved: number } {
  const counted = allCalls.filter((c) => !c.early && c.timing !== "live");
  const lines = (["Wager", "Lean"] as const).map((call) => {
    const mine = counted.filter((c) => c.call === call);
    const done = mine.filter((c) => c.result === "won" || c.result === "lost");
    const won = done.filter((c) => c.result === "won").length;
    return {
      call,
      won,
      lost: done.length - won,
      profit: done.reduce((s, c) => s + (c.profit ?? 0), 0),
      staked: done.length,
      open: mine.filter((c) => c.result === "open").length,
    };
  });
  return { lines, resolved: lines.reduce((n, l) => n + l.won + l.lost, 0) };
}
