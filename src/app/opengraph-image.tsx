import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The card shown when a HedgePredict link is pasted into iMessage, Facebook, Discord, X, Slack:
// the mark and name, what it is in one line, and the address. Dark, like the site.
export const alt = "HedgePredict: free calls on Polymarket US markets, and a sandbox to test a bet before you place it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ICE = "#c9e2f2";
const INK = "#f1f3f5";
const SOFT = "#a3a9b2";
const BG = "#0c0f13";

export default async function Image() {
  const [bold, medium] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Inter-800.ttf")),
    readFile(join(process.cwd(), "src/app/fonts/Inter-500.ttf")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: "72px 80px", fontFamily: "Inter" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* The Split mark: the call card's three-part bar, stacked, the sides trading places. */}
          <svg width="76" height="76" viewBox="7 7 34 34">
            <rect x="7" y="7" width="21" height="9" fill={ICE} />
            <rect x="31.5" y="7" width="9.5" height="9" fill={ICE} opacity="0.5" />
            <rect x="7" y="19.5" width="34" height="9" fill={ICE} />
            <rect x="7" y="32" width="9.5" height="9" fill={ICE} opacity="0.5" />
            <rect x="20" y="32" width="21" height="9" fill={ICE} />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.045em", color: ICE }}>HedgePredict</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.02, color: INK }}>Find the price that&apos;s off.</div>
          <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.35, color: SOFT, maxWidth: 960 }}>
            Free calls on Polymarket US markets, and a sandbox to test a bet before you place it.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>hedgepredict.co</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: SOFT }}>Decision support, not financial advice</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: bold, weight: 800, style: "normal" },
        { name: "Inter", data: medium, weight: 500, style: "normal" },
      ],
    }
  );
}
