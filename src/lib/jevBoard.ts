/**
 * Jev's read on the whole board, cached per market for 10 minutes, or 2 minutes
 * while a game is live (per server instance). Shared by /api/jev/board and the newsletter so both see the same
 * calls and TypeSafe usage stays flat.
 */
import { fetchBoard } from "./board";
import { jevRead, toJevDTO, MissingJevKeyError } from "./jev";
import type { ScoredMarket } from "./scoring";
import type { JevReadDTO } from "./dto";
import { LIVE_WINDOW_MS } from "./format";
import { recordCallChangesLater } from "./callHistory";
import type { CategoryId } from "./filters";

const TTL_MS = 10 * 60 * 1000;
/** Live games move fast, and only a handful are live at once, so their calls refresh more often. */
const LIVE_TTL_MS = 2 * 60 * 1000;

const isLiveGame = (m: ScoredMarket, now: number) => {
  const t = m.gameStartTime?.getTime();
  return t != null && now >= t && now - t < LIVE_WINDOW_MS;
};
const CONCURRENCY = 6;
const cache = new Map<string, { at: number; dto: JevReadDTO }>();

export interface BoardReads {
  markets: ScoredMarket[];
  reads: Record<string, JevReadDTO>;
}

/** Throws MissingJevKeyError if TypeSafe isn't configured. */
/** Category boards share the per-market cache, so a market on two boards is read once. */
/** `limit` reads only the board's top markets (the Daily's beats use 8, to keep TypeSafe use down). */
export async function getBoardReads(category: CategoryId = "all", limit?: number): Promise<BoardReads> {
  if (!process.env.TYPESAFE_API_KEY) throw new MissingJevKeyError();
  const board = await fetchBoard(category);
  const markets = limit ? board.slice(0, limit) : board;

  const now = Date.now();
  const reads: Record<string, JevReadDTO> = {};
  const todo = markets.filter((m) => {
    const hit = cache.get(m.id);
    if (hit && now - hit.at < (isLiveGame(m, now) ? LIVE_TTL_MS : TTL_MS)) {
      reads[m.id] = hit.dto;
      return false;
    }
    return true;
  });

  // Small worker pool: fast, but gentle on TypeSafe's rate limits. A market
  // that fails just has no read (the UI shows its "Ask Jev" button).
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      while (next < todo.length) {
        const m = todo[next++];
        try {
          const dto = toJevDTO(m, await jevRead(m));
          cache.set(m.id, { at: Date.now(), dto });
          reads[m.id] = dto;
        } catch {
          /* leave this market without a read */
        }
      }
    })
  );

  // Keep the call timeline: only fresh reads can differ from what's stored.
  recordCallChangesLater(todo.map((m) => reads[m.id]).filter(Boolean));

  return { markets, reads };
}
