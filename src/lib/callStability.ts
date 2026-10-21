/**
 * Steady calls. The model's read for a market sits on a line between "a tilt" and "priced fair", and a tiny move in the
 * numbers flips it back and forth (a week of data: 938 of 1,018 call changes were Skip <-> Lean flips, over half within
 * the hour). So the board shows, and the call log + track record keep, a market's *confirmed* call, and a different
 * call only takes over once every read has agreed on it for HOLD_MS. The model's output is untouched; only how fast the
 * label flips changes. A market's very first call is shown at once (and logged once it holds); "decided" shows at once.
 *
 * State lives in the database (call_changes = confirmed, call_pending = a challenger and since when), because each
 * serverless instance has its own read cache. If the database is missing or the table isn't migrated yet, reads pass through raw.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { callChanges, callPending } from "@/db/schema";
import type { JevReadDTO } from "./dto";
import { stateOf } from "./callHistory";
import { showConfirmed, step, type Key } from "./callStabilityCore";

export { HOLD_MS } from "./callStabilityCore";

export type FreshRead = { read: JevReadDTO; gameStart: Date | null };

/** Raw reads in, steady reads out (same order). Never throws: on any trouble, returns the raw reads. */
export async function steadyReads(fresh: FreshRead[], now = Date.now()): Promise<JevReadDTO[]> {
  const raw = fresh.map((f) => f.read);
  if (!fresh.length || !process.env.DATABASE_URL) return raw;
  try {
    const ids = raw.map((r) => r.marketId);
    const list = sql`(${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
    const [lastRows, pendingRows] = await Promise.all([
      db.execute<{ market_id: string; action: string; side: string | null }>(sql`
        select distinct on (market_id) market_id, action, side from call_changes
        where market_id in ${list} order by market_id, at desc`),
      db.select().from(callPending).where(inArray(callPending.marketId, ids)),
    ]);
    const confirmed = new Map(lastRows.rows.map((r) => [r.market_id, r as Key]));
    const pending = new Map(pendingRows.map((r) => [r.marketId, r]));
    const starts = new Map(fresh.map((f) => [f.read.marketId, f.gameStart]));

    const toLog: (typeof callChanges.$inferInsert)[] = [];
    const toPend: (typeof callPending.$inferInsert)[] = [];
    const toClear: string[] = [];

    const out = raw.map((r) => {
      const s = stateOf(r);
      const c = confirmed.get(r.marketId);
      const p = pending.get(r.marketId);
      const d = step(s, c, p && { action: p.action, side: p.side, since: p.since.getTime() }, now);
      if (d.log) toLog.push({ marketId: r.marketId, question: r.marketName, action: s.action, side: s.side, sidePrice: s.price, howSure: s.howSure, gameStart: starts.get(r.marketId) ?? null });
      if (d.pend) toPend.push({ marketId: r.marketId, action: s.action, side: s.side, since: new Date(now) });
      if (d.clear) toClear.push(r.marketId);
      return d.show === "confirmed" && c ? showConfirmed(r, c) : r;
    });

    if (toLog.length) await db.insert(callChanges).values(toLog);
    if (toPend.length) {
      await db.insert(callPending).values(toPend).onConflictDoUpdate({
        target: callPending.marketId,
        set: { action: sql`excluded.action`, side: sql`excluded.side`, since: sql`excluded.since` },
      });
    }
    for (const id of toClear) await db.delete(callPending).where(eq(callPending.marketId, id));
    return out;
  } catch {
    return raw; // e.g. call_pending not migrated yet: no smoothing, nothing breaks
  }
}
