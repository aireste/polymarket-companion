/**
 * Jev's read on the whole board, cached per market for 10 minutes (per server
 * instance). Shared by /api/jev/board and the newsletter so both see the same
 * calls and TypeSafe usage stays flat.
 */
import { fetchBoard } from "./board";
import { jevRead, toJevDTO, MissingJevKeyError } from "./jev";
import type { ScoredMarket } from "./scoring";
import type { JevReadDTO } from "./dto";

const TTL_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;
const cache = new Map<string, { at: number; dto: JevReadDTO }>();

export interface BoardReads {
  markets: ScoredMarket[];
  reads: Record<string, JevReadDTO>;
}

/** Throws MissingJevKeyError if TypeSafe isn't configured. */
export async function getBoardReads(): Promise<BoardReads> {
  if (!process.env.TYPESAFE_API_KEY) throw new MissingJevKeyError();
  const markets = await fetchBoard();

  const now = Date.now();
  const reads: Record<string, JevReadDTO> = {};
  const todo = markets.filter((m) => {
    const hit = cache.get(m.id);
    if (hit && now - hit.at < TTL_MS) {
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

  return { markets, reads };
}
