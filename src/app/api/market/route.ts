import { fetchMarketById, parseMarketId } from "@/lib/polymarket";
import { toPlayDTO } from "@/lib/board";

export const dynamic = "force-dynamic";

/**
 * GET /api/market?id=<eventSlug~marketSlug> → { play: PlayDTO }, with lifetime volume and liquidity
 * from its order book. For links to off-board markets and the detail view's stats.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !parseMarketId(id)) {
    return Response.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  try {
    const market = await fetchMarketById(id);
    if (!market) return Response.json({ error: "Market not found" }, { status: 404 });
    return Response.json({ play: toPlayDTO(market) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
