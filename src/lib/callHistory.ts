/**
 * How a market's call moved: Lean Falcons → Wager Falcons → Skip. A row is written only when a
 * fresh read differs from the market's last row (the call or its side), so steady markets cost
 * nothing. Recording runs after the response (next/server `after`), never on the request path.
 */
import { after } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { callChanges } from "@/db/schema";
import type { CallChangeDTO, JevReadDTO } from "./dto";

type State = { action: CallChangeDTO["action"]; side: string | null; price: number | null; howSure: number };

function stateOf(r: JevReadDTO): State {
  const top = r.sides.length ? Math.max(...r.sides.map((s) => s.price)) : null;
  if (r.settled) return { action: "decided", side: null, price: top, howSure: r.strength };
  if (r.lean == null || r.action === "skip") return { action: "skip", side: null, price: top, howSure: r.strength };
  const s = r.sides[r.lean];
  return { action: r.action, side: s.label, price: s.price, howSure: r.strength };
}

export type FreshRead = { read: JevReadDTO; gameStart: Date | null };

/** Write a row for each market whose call changed since its last row. */
export async function recordCallChanges(fresh: FreshRead[]) {
  if (!fresh.length || !process.env.DATABASE_URL) return;
  const reads = fresh.map((f) => f.read);
  const starts = new Map(fresh.map((f) => [f.read.marketId, f.gameStart]));
  const ids = reads.map((r) => r.marketId);
  const last = await db.execute<{ market_id: string; action: string; side: string | null }>(sql`
    select distinct on (market_id) market_id, action, side
    from call_changes
    where market_id in ${sql`(${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`}
    order by market_id, at desc`);
  const prev = new Map(last.rows.map((r) => [r.market_id, r]));
  const rows = reads.flatMap((r) => {
    const s = stateOf(r);
    const p = prev.get(r.marketId);
    if (p && p.action === s.action && (p.side ?? null) === s.side) return [];
    // A market's first-ever row is only worth keeping if it's an actual call.
    if (!p && (s.action === "skip" || s.action === "decided")) return [];
    return [{ marketId: r.marketId, question: r.marketName, action: s.action, side: s.side, sidePrice: s.price, howSure: s.howSure, gameStart: starts.get(r.marketId) ?? null }];
  });
  if (rows.length) await db.insert(callChanges).values(rows);
}

/** Run `recordCallChanges` after the response when inside a request, else just in the background. */
export function recordCallChangesLater(fresh: FreshRead[]) {
  const job = () => recordCallChanges(fresh).catch(() => {});
  try {
    after(job);
  } catch {
    void job();
  }
}

/** A market's changes, oldest first. */
export async function getCallHistory(marketId: string): Promise<CallChangeDTO[]> {
  const rows = await db
    .select()
    .from(callChanges)
    .where(eq(callChanges.marketId, marketId))
    .orderBy(asc(callChanges.at))
    .limit(50);
  return rows.map((r) => ({
    at: r.at.toISOString(),
    action: r.action as CallChangeDTO["action"],
    side: r.side,
    price: r.sidePrice,
  }));
}

