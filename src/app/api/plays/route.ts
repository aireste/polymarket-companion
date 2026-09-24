import { fetchMarkets } from "@/lib/polymarket";
import { rankMarkets } from "@/lib/scoring";
import type { PlayDTO } from "@/lib/dto";

// Live odds move constantly; never cache this handler.
export const dynamic = "force-dynamic";

/** GET /api/plays — today's ranked markets worth a look. */
export async function GET() {
  try {
    const markets = await fetchMarkets({ limit: 150, orderBy: "volume24hr" });
    const ranked = rankMarkets(markets, { limit: 18, minLiquidity: 1000 });

    const plays: PlayDTO[] = ranked.map((m) => ({
      id: m.id,
      question: m.question,
      url: m.url,
      imageUrl: m.imageUrl,
      outcomes: m.outcomes.map((o) => ({
        label: o.label,
        price: o.price,
        tokenId: o.tokenId,
      })),
      volume: m.volume,
      volume24hr: m.volume24hr,
      liquidity: m.liquidity,
      endDate: m.endDate ? m.endDate.toISOString() : null,
      gameStartTime: m.gameStartTime ? m.gameStartTime.toISOString() : null,
      score: m.score,
      signals: m.signals,
    }));

    return Response.json({ plays, asOf: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
