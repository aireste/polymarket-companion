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
import type { RecordCall } from "./recordMath";

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

export interface TrackRecord {
  asOf: string;
  /** Every call, newest first. The page derives all its numbers from this (see recordMath.ts). */
  calls: RecordCall[];
}

export async function getTrackRecord(): Promise<TrackRecord> {
  const rows = await db.select().from(calls).orderBy(sql`${calls.loggedAt} desc`);
  return {
    asOf: new Date().toISOString(),
    calls: rows.map((r) => ({
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
    })),
  };
}
