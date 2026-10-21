import { getCallHistory } from "@/lib/callHistory";
import { fetchMarketById } from "@/lib/polymarket";
import { OG_SIZE, renderMarketOg, renderOg } from "@/lib/ogCard";

// The card behind a /share/<market id> link. X's crawler gives up fast, so this must not re-run Jev:
// it reads the market's latest logged call from the database and its live price from Polymarket.
// Nothing comes from the URL but the id, so nobody can make HedgePredict show a call Jev did not make.
// Unknown ids, or markets whose latest call is a Skip, get the standard card.
export const alt = "A HedgePredict call on a Polymarket US market.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marketId = decodeURIComponent(id);
  try {
    const [history, market] = await Promise.all([getCallHistory(marketId), fetchMarketById(marketId)]);
    const last = history.at(-1);
    if (market && last && last.side && (last.action === "wager" || last.action === "hold")) {
      const live = market.outcomes.find((o) => o.label === last.side);
      const price = live?.price ?? last.price;
      if (price != null) return renderMarketOg({ marketName: market.question, action: last.action, side: { label: last.side, price } });
    }
  } catch (e) {
    console.error("share card fallback", e); // fall through to the standard card
  }
  return renderOg();
}
