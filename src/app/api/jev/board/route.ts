import { fetchBoard } from "@/lib/board";
import { jevRead, toJevDTO, MissingJevKeyError } from "@/lib/jev";
import type { JevReadDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Jev's call on the whole board in one request, so the table can show a
 * verdict on every row without each visitor firing 18 reads. Reads are cached
 * per market for 10 minutes (per server instance), which keeps TypeSafe usage
 * flat no matter how many people open the app.
 */
const TTL_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;
const cache = new Map<string, { at: number; dto: JevReadDTO }>();

/** GET /api/jev/board */
export async function GET() {
  if (!process.env.TYPESAFE_API_KEY) {
    return Response.json({ available: false, reason: new MissingJevKeyError().message });
  }

  let board;
  try {
    board = await fetchBoard();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Board lookup failed";
    return Response.json({ error: message }, { status: 502 });
  }

  const now = Date.now();
  const reads: Record<string, JevReadDTO> = {};
  const todo = board.filter((m) => {
    const hit = cache.get(m.id);
    if (hit && now - hit.at < TTL_MS) {
      reads[m.id] = hit.dto;
      return false;
    }
    return true;
  });

  // Small worker pool: fast, but gentle on TypeSafe's rate limits. A market
  // that fails just shows its "Ask Jev" button instead of a verdict.
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

  return Response.json({ reads, asOf: new Date().toISOString() });
}
