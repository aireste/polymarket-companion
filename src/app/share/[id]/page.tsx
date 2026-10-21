import type { Metadata } from "next";
import { RedirectToBoard } from "./RedirectToBoard";

// A share link for one market. Scrapers (X, iMessage, Slack) read the card from this page's metadata;
// people land on the board with that market selected.
export const metadata: Metadata = {
  title: "HedgePredict: find the price that's off",
  description: "Free calls on Polymarket US markets, in plain English.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RedirectToBoard id={decodeURIComponent(id)} />;
}
