import { renderOg, OG_SIZE } from "@/lib/ogCard";

// The card shown when a HedgePredict link is pasted into iMessage, Facebook, Discord, X, Slack:
// the headline beside a call card (43¢ · Wager), on the site's dark look. Drawn in lib/ogCard.tsx.
export const alt = "HedgePredict: find the price that's off. Free calls on Polymarket US markets, in plain English.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg();
}
