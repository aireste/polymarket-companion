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

export async function gradeOpenCalls() {
  const open = await db.select().from(calls).where(eq(calls.result, "open"));
  let graded = 0;
  // One Gamma lookup per market, even if it has several open calls.
  for (const marketId of new Set(open.map((c) => c.marketId))) {
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
      const won = winner === c.side;
      await db
        .update(calls)
        .set({
          result: winner == null ? "void" : won ? "won" : "lost",
          // $1 buys 1/price shares that pay $1 each if the side wins.
          profit: winner == null ? 0 : won ? 1 / c.sidePrice - 1 : -1,
          resolvedAt: new Date(),
        })
        .where(and(eq(calls.id, c.id), eq(calls.result, "open")));
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
