import { searchMarkets } from "@/lib/polymarket";
import { toPlayDTO } from "@/lib/board";

export const dynamic = "force-dynamic";

/** GET /api/search?q=<text> → { plays: PlayDTO[] } across all of Polymarket. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ plays: [] });
  try {
    const plays = (await searchMarkets(q.slice(0, 80), 8)).map(toPlayDTO);
    return Response.json({ plays });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
