/**
 * HedgePredict's track record, run by Vercel Cron every 30 minutes (replaces the Mac's launchd job):
 *  1. log every new Wager/Lean on the board with the called side's price at that moment;
 *  2. grade open calls once Polymarket resolves their market.
 * One row per market + call + side, the first time it's seen; a Lean that becomes a Wager is a
 * new row, so both are graded. Never log after a market's end (the result could already be known).
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { getBoardReads } from "./jevBoard";
import { fetchResults, parseMarketId } from "./polymarket";

/** Calls logged before the switch to Polymarket US have numeric international ids; they're graded there. */
const GAMMA = "https://gamma-api.polymarket.com";
const CALL = { wager: "Wager", hold: "Lean" } as const;

export async function logNewCalls() {
  const { markets, reads } = await getBoardReads("all");
  const now = Date.now();
  const rows = markets.flatMap((m) => {
    const r = reads[m.id];
    if (!r || r.settled || r.lean == null || !(r.action in CALL)) return [];
    if (m.endDate && m.endDate.getTime() <= now) return [];
    const side = r.sides[r.lean];
    const start = m.gameStartTime?.getTime();
    return [{
      marketId: m.id,
      question: r.marketName || m.question,
      call: CALL[r.action as keyof typeof CALL],
      side: side.label,
      sideIndex: r.lean,
      sidePrice: side.price,
      howSure: r.strength,
      confidence: r.confidence,
      resolvesAt: m.endDate,
      phase: start == null ? null : start <= now ? "live" : "pre-game",
      model: r.model ?? "",
    }];
  });
  if (!rows.length) return 0;
  const added = await db.insert(calls).values(rows).onConflictDoNothing().returning({ id: calls.id });
  return added.length;
}

interface GammaMarket {
  closed?: boolean;
  umaResolutionStatus?: string | null;
  outcomes?: string;
  outcomePrices?: string;
}

async function settle(id: number, sidePrice: number, won: boolean | null) {
  await db
    .update(calls)
    .set({
      result: won == null ? "void" : won ? "won" : "lost",
      // $1 buys 1/price shares that pay $1 each if the side wins.
      profit: won == null ? 0 : won ? 1 / sidePrice - 1 : -1,
      resolvedAt: new Date(),
    })
    .where(and(eq(calls.id, id), eq(calls.result, "open")));
}

export async function gradeOpenCalls() {
  const open = await db.select().from(calls).where(eq(calls.result, "open"));
  let graded = 0;

  // Polymarket US calls: one batched look at their events tells us which markets have resolved.
  const usCalls = open.flatMap((c) => {
    const ref = parseMarketId(c.marketId);
    return ref ? [{ c, ref }] : [];
  });
  const results = await fetchResults(usCalls.map((x) => x.ref.event));
  for (const { c, ref } of usCalls) {
    const r = results.get(ref.market);
    if (r === undefined) continue; // still open
    // 1 = the long side (outcome 0) won, 0 = the short side did; "void" = no clear winner.
    await settle(c.id, c.sidePrice, r === "void" || c.sideIndex == null ? null : (c.sideIndex === 0) === (r === 1));
    graded++;
  }

  // Calls from before the switch (numeric international ids): one Gamma lookup per market.
  for (const marketId of new Set(open.filter((c) => !parseMarketId(c.marketId)).map((c) => c.marketId))) {
    let m: GammaMarket;
    try {
      const res = await fetch(`${GAMMA}/markets/${encodeURIComponent(marketId)}`, { cache: "no-store" });
      if (!res.ok) continue;
      m = await res.json();
    } catch {
      continue;
    }
    if (!m.closed || (m.umaResolutionStatus != null && m.umaResolutionStatus !== "resolved")) continue;
    const outcomes: string[] = JSON.parse(m.outcomes || "[]");
    const prices = (JSON.parse(m.outcomePrices || "[]") as string[]).map(Number);
    if (!outcomes.length || outcomes.length !== prices.length) continue;
    const top = Math.max(...prices);
    const winner = top >= 0.99 ? outcomes[prices.indexOf(top)] : null; // null: no clear winner (refund / 50-50)
    for (const c of open.filter((x) => x.marketId === marketId)) {
      await settle(c.id, c.sidePrice, winner == null ? null : winner === c.side);
      graded++;
    }
  }
  return graded;
}

/** Hit rate and return per call, for Wager and Lean. */
export async function trackSummary() {
  const rows = await db
    .select({
      call: calls.call,
      logged: sql<number>`count(*)::int`,
      resolved: sql<number>`count(*) filter (where ${calls.result} in ('won','lost'))::int`,
      won: sql<number>`count(*) filter (where ${calls.result} = 'won')::int`,
      profit: sql<number>`coalesce(sum(${calls.profit}) filter (where ${calls.result} in ('won','lost')), 0)::float`,
    })
    .from(calls)
    .groupBy(calls.call);
  return rows.map((r) => ({
    ...r,
    hitRate: r.resolved ? r.won / r.resolved : null,
    returnPerCall: r.resolved ? r.profit / r.resolved : null,
  }));
}

/* ── The public scorecard ── */

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
  /** Made before the switch to Polymarket US (international prices): listed, not counted. */
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

export interface TrackRecord {
  since: string | null;
  asOf: string;
  all: RecordLine;
  byCall: RecordLine[];
  bySure: RecordLine[];
  /** The record split into calls on games (made before kickoff) and on everything else. */
  byTiming: RecordLine[];
  /**
   * Calls made while a game was being played. Kept out of the record above: mid-game prices swing
   * hard and the model can land on both teams in one game, so they say little about whether it
   * read the market right beforehand. Shown on their own.
   */
  live: { all: RecordLine; byCall: RecordLine[] };
  /**
   * Running profit at a flat $1 a call, one point per resolved call, in the order the calls were
   * made. (Not the order they were graded: grading happens in batches, so many share a timestamp.)
   */
  curve: { t: number; v: number; question: string; call: string; side: string; won: boolean; profit: number }[];
  /** How much of the total rests on a couple of results: the two biggest wins and the total without them. */
  topWins: { names: string[]; sum: number; without: number } | null;
  calls: RecordCall[];
  earlyCount: number;
}

function line(label: string, rows: RecordCall[]): RecordLine {
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

/**
 * Everything the scorecard page shows.
 *
 * The record answers one question: did HedgePredict call it right BEFORE the event? So it counts
 * calls made before a game started and calls on markets that aren't games (futures, elections).
 * Calls made during a live game are reported separately and never mixed in.
 *
 * Only calls made on Polymarket US count at all: the first few dozen were made on international
 * Polymarket prices with different model inputs, so they're listed but kept out of the totals.
 */
export async function getTrackRecord(): Promise<TrackRecord> {
  const rows = await db.select().from(calls).orderBy(sql`${calls.loggedAt} desc`);
  const all: RecordCall[] = rows.map((r) => ({
    id: r.id,
    loggedAt: r.loggedAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    question: r.question,
    call: r.call as RecordCall["call"],
    side: r.side,
    sidePrice: r.sidePrice,
    howSure: r.howSure,
    result: r.result as RecordCall["result"],
    profit: r.profit,
    early: !r.marketId.includes("~"),
    timing: r.phase === "pre-game" || r.phase === "live" ? r.phase : "other",
  }));
  const us = all.filter((c) => !c.early);
  const counted = us.filter((c) => c.timing !== "live");
  const inGame = us.filter((c) => c.timing === "live");
  const done = counted
    .filter((c) => c.result === "won" || c.result === "lost")
    .sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt) || a.id - b.id);
  let run = 0;
  const curve = done.map((c) => {
    run += c.profit ?? 0;
    return { t: Date.parse(c.loggedAt), v: run, question: c.question, call: c.call, side: c.side, won: c.result === "won", profit: c.profit ?? 0 };
  });
  const wins = done.filter((c) => (c.profit ?? 0) > 0).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).slice(0, 2);
  const topSum = wins.reduce((s, c) => s + (c.profit ?? 0), 0);
  const topWins = done.length >= 5 && wins.length === 2 ? { names: wins.map((c) => `${c.side} at ${Math.round(c.sidePrice * 100)}¢`), sum: topSum, without: run - topSum } : null;
  const band = (lo: number, hi: number) => counted.filter((c) => c.howSure >= lo && c.howSure < hi);
  return {
    since: counted.length ? counted[counted.length - 1].loggedAt : null,
    asOf: new Date().toISOString(),
    all: line("All calls", counted),
    byCall: [line("Wager", counted.filter((c) => c.call === "Wager")), line("Lean", counted.filter((c) => c.call === "Lean"))],
    bySure: [line("Under 35% sure", band(0, 0.35)), line("35 to 50% sure", band(0.35, 0.5)), line("50% sure or more", band(0.5, 2))],
    byTiming: [
      line("Games, called before kickoff", counted.filter((c) => c.timing === "pre-game")),
      line("Futures, elections and other", counted.filter((c) => c.timing === "other")),
    ],
    live: {
      all: line("All in-game calls", inGame),
      byCall: [line("Wager", inGame.filter((c) => c.call === "Wager")), line("Lean", inGame.filter((c) => c.call === "Lean"))],
    },
    curve,
    topWins,
    calls: all,
    earlyCount: all.filter((c) => c.early).length,
  };
}
