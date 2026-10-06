/**
 * How a market's call moved: Lean Falcons → Wager Falcons → Skip. A row is written only when a
 * fresh read differs from the market's last row (the call or its side), so steady markets cost
 * nothing. Recording runs after the response (next/server `after`), never on the request path.
 */
import { after } from "next/server";
import { asc, eq, gte, sql } from "drizzle-orm";
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

/* ── The matrix on the track record page ── */

export interface MatrixRow {
  marketId: string;
  question: string;
  /** The call in force at the end of each time slot; null before the first recorded call or after it resolved. */
  cells: (CallChangeDTO["action"] | null)[];
  /** First slot after the game started (sports), else null. */
  liveCol: number | null;
  /** The latest recorded call. */
  last: { action: CallChangeDTO["action"]; side: string | null; price: number | null };
  changes: number;
  /** The latest graded Wager/Lean on this market, if any. */
  result: { result: "won" | "lost" | "void"; call: string; side: string; profit: number | null; at: string } | null;
}

export interface CallMatrix {
  start: string;
  stepMs: number;
  cols: number;
  rows: MatrixRow[];
}

/** Every market with a call in the last `hours`, as rows of time slots colored by the call in force. */
export async function getCallMatrix(hours = 48, slotHours = 2, limit = 40): Promise<CallMatrix> {
  const stepMs = slotHours * 3_600_000;
  const cols = Math.round(hours / slotHours);
  const end = Date.now();
  const start = end - cols * stepMs;
  const since = new Date(start);

  // Changes inside the window, plus each market's last row before it (the call it walked in with).
  const inWindow = await db.select().from(callChanges).where(gte(callChanges.at, since)).orderBy(asc(callChanges.at));
  const before = await db.execute<{ market_id: string; question: string; action: string; side: string | null; side_price: number | null; game_start: string | null; at: string }>(sql`
    select distinct on (market_id) market_id, question, action, side, side_price, game_start, at
    from call_changes where at < ${since.toISOString()}
    order by market_id, at desc`);

  type Step = { at: number; action: CallChangeDTO["action"]; side: string | null; price: number | null };
  const byMarket = new Map<string, { question: string; steps: Step[]; gameStart: number | null; changes: number }>();
  const get = (id: string, q: string) => {
    let m = byMarket.get(id);
    if (!m) byMarket.set(id, (m = { question: q, steps: [], gameStart: null, changes: 0 }));
    return m;
  };
  for (const r of before.rows) {
    // A market that walked in on a Skip/Decided and never changed isn't worth a row.
    if (r.action !== "wager" && r.action !== "hold") continue;
    const m = get(r.market_id, r.question);
    m.steps.push({ at: start, action: r.action as Step["action"], side: r.side, price: r.side_price });
    if (r.game_start) m.gameStart = Date.parse(r.game_start);
  }
  for (const r of inWindow) {
    const m = get(r.marketId, r.question);
    m.steps.push({ at: r.at.getTime(), action: r.action as Step["action"], side: r.side, price: r.sidePrice });
    m.changes++;
    if (r.gameStart) m.gameStart = r.gameStart.getTime();
  }

  // Results: the latest graded call per market.
  const ids = [...byMarket.keys()];
  const graded = ids.length
    ? await db.execute<{ market_id: string; result: string; call: string; side: string; profit: number | null; resolved_at: string }>(sql`
        select distinct on (market_id) market_id, result, call, side, profit, resolved_at
        from calls where result <> 'open' and market_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        order by market_id, resolved_at desc`)
    : { rows: [] };
  const results = new Map(graded.rows.map((r) => [r.market_id, r]));

  const ranked = [...byMarket.entries()].map(([marketId, m]) => {
    const res = results.get(marketId);
    const doneAt = res?.resolved_at ? Date.parse(res.resolved_at) : null;
    const cells = Array.from({ length: cols }, (_, i) => {
      const t = start + (i + 1) * stepMs;
      if (doneAt != null && t - stepMs > doneAt) return null;
      let cur: Step["action"] | null = null;
      for (const s of m.steps) if (s.at <= t) cur = s.action;
      return cur;
    });
    const liveCol = m.gameStart != null && m.gameStart > start && m.gameStart < end ? Math.floor((m.gameStart - start) / stepMs) : null;
    const lastStep = m.steps[m.steps.length - 1];
    const row: MatrixRow = {
      marketId,
      question: m.question,
      cells,
      liveCol,
      last: { action: lastStep.action, side: lastStep.side, price: lastStep.price },
      changes: m.changes,
      result: res ? { result: res.result as "won" | "lost" | "void", call: res.call, side: res.side, profit: res.profit, at: res.resolved_at } : null,
    };
    return { row, latest: lastStep.at };
  });
  // Most recently changed first.
  ranked.sort((a, b) => b.latest - a.latest);
  return { start: since.toISOString(), stepMs, cols, rows: ranked.slice(0, limit).map((x) => x.row) };
}
