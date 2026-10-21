/**
 * How a market's call moved: Lean Falcons → Wager Falcons → Skip. Rows are written by
 * callStability.ts, only once a changed call has held steady for the hold time.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { callChanges } from "@/db/schema";
import type { CallChangeDTO, JevReadDTO } from "./dto";

export type State = { action: CallChangeDTO["action"]; side: string | null; price: number | null; howSure: number };

export function stateOf(r: JevReadDTO): State {
  const top = r.sides.length ? Math.max(...r.sides.map((s) => s.price)) : null;
  if (r.settled) return { action: "decided", side: null, price: top, howSure: r.strength };
  if (r.lean == null || r.action === "skip") return { action: "skip", side: null, price: top, howSure: r.strength };
  const s = r.sides[r.lean];
  return { action: r.action, side: s.label, price: s.price, howSure: r.strength };
}

/** A market's latest 50 changes, oldest first. (Newest first in the query: capping the oldest-first list would show the first 50 ever and hide where the call is now.) */
export async function getCallHistory(marketId: string): Promise<CallChangeDTO[]> {
  const rows = (
    await db
      .select()
      .from(callChanges)
      .where(eq(callChanges.marketId, marketId))
      .orderBy(desc(callChanges.at))
      .limit(50)
  ).reverse();
  return rows.map((r) => ({
    at: r.at.toISOString(),
    action: r.action as CallChangeDTO["action"],
    side: r.side,
    price: r.sidePrice,
  }));
}

