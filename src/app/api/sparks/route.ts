import { fetchHistory, isTokenId } from "@/lib/history";
import type { HistoryPoint } from "@/lib/dto";

export const dynamic = "force-dynamic";

/** Sparklines don't need to be live to the second; cache each for 10 minutes. */
const TTL_MS = 10 * 60 * 1000;
const MAX_TOKENS = 40;
const cache = new Map<string, { at: number; points: HistoryPoint[] }>();

/** GET /api/sparks?tokens=<id>,<id>,... → { sparks: { [token]: HistoryPoint[] } } (1W) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokens = (searchParams.get("tokens") ?? "")
    .split(",")
    .filter(isTokenId)
    .slice(0, MAX_TOKENS);

  const now = Date.now();
  const sparks: Record<string, HistoryPoint[]> = {};
  await Promise.all(
    tokens.map(async (token) => {
      const hit = cache.get(token);
      if (hit && now - hit.at < TTL_MS) {
        sparks[token] = hit.points;
        return;
      }
      try {
        const points = await fetchHistory(token, "1w");
        cache.set(token, { at: Date.now(), points });
        sparks[token] = points;
      } catch {
        /* no sparkline for this one */
      }
    })
  );

  return Response.json({ sparks });
}
