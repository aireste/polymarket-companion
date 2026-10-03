/**
 * Server-side board helpers: the ranked set of markets the dashboard shows, and
 * the Market -> PlayDTO mapping every route shares (board, search, lookup).
 */

import { fetchMarkets, type Market } from "./polymarket";
import { rankMarkets, type ScoredMarket, type Signals } from "./scoring";
import type { PlayDTO } from "./dto";
import { categoryById, type CategoryId } from "./filters";

const NO_SIGNALS: Signals = {
  momentum: 0,
  liquidity: 0,
  uncertainty: 0,
  timeliness: 0,
};

/**
 * Today's ranked board: the 18 markets worth a look, from Polymarket US. A category board ranks
 * the same way inside its Polymarket US categories.
 */
export async function fetchBoard(category: CategoryId = "all"): Promise<ScoredMarket[]> {
  const { us } = categoryById(category);
  const markets = await fetchMarkets({ categories: us });
  // Category boards skip markets that are already settled in all but name (one side at 97%+,
  // same line as Jev's "Decided"), e.g. today's Bitcoin price brackets. The main board is unchanged.
  const pool = us == null ? markets : markets.filter((m) => m.outcomes.every((o) => o.price < 0.97));
  return rankMarkets(pool, { limit: 18 });
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
    spread: m.spread,
    endDate: m.endDate ? m.endDate.toISOString() : null,
    gameStartTime: m.gameStartTime ? m.gameStartTime.toISOString() : null,
    score: scored?.score ?? 0,
    signals: scored?.signals ?? NO_SIGNALS,
  };
}
