/**
 * Server-side board helpers: the ranked set of markets the dashboard shows, and
 * the Market -> PlayDTO mapping every route shares (board, search, lookup).
 */

import { fetchMarkets, type Market } from "./polymarket";
import { rankMarkets, type ScoredMarket, type Signals } from "./scoring";
import type { PlayDTO } from "./dto";

const NO_SIGNALS: Signals = {
  momentum: 0,
  liquidity: 0,
  uncertainty: 0,
  timeliness: 0,
};

/** Today's ranked board: the 18 markets worth a look. */
export async function fetchBoard(): Promise<ScoredMarket[]> {
  const markets = await fetchMarkets({ limit: 150, orderBy: "volume24hr" });
  return rankMarkets(markets, { limit: 18, minLiquidity: 1000 });
}

/**
 * Serialize a market for the client. Off-board markets (search, deep links)
 * aren't ranked, so they get a zero score and flat signals.
 */
export function toPlayDTO(m: Market | ScoredMarket): PlayDTO {
  const scored = "score" in m ? m : null;
  return {
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
    score: scored?.score ?? 0,
    signals: scored?.signals ?? NO_SIGNALS,
  };
}
