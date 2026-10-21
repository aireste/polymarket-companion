import { getBoardReads } from "@/lib/jevBoard";
import { OG_SIZE, renderMarketOg, renderOg } from "@/lib/ogCard";

// The card behind a /share/<market id> link. It is built from the live board, never from the URL,
// so nobody can make HedgePredict show a call Jev did not make. Unknown ids get the standard card.
export const alt = "A HedgePredict call on a Polymarket US market.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { reads } = await getBoardReads("all", 18);
    const read = reads[decodeURIComponent(id)];
    if (read && !read.settled && read.lean != null && read.action !== "skip") return renderMarketOg(read);
  } catch (e) {
    console.error("share card fallback", e); // fall through to the standard card
  }
  return renderOg();
}
