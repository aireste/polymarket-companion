import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The share card (iMessage, X, Slack, Discord): 1200×630. It shows the product's
 * strongest moment, a price and its call, on the site's dark look. The example
 * market is fixed (the tour's Kentucky game) so a shared card never goes stale.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const ICE = "#c9e2f2";
const INK = "#f1f3f5";
const SOFT = "#a3a9b2";
const BG = "#0c0f13";
const PANEL = "#151a20";
const RULE = "#252b33";
const WAGER = "#5cd47f";

/** The Split mark: the call bar's three parts, stacked, the sides trading places. */
function Mark({ size, color = ICE }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="7 7 34 34">
      <rect x="7" y="7" width="21" height="9" fill={color} />
      <rect x="31.5" y="7" width="9.5" height="9" fill={color} opacity="0.5" />
      <rect x="7" y="19.5" width="34" height="9" fill={color} />
      <rect x="7" y="32" width="9.5" height="9" fill={color} opacity="0.5" />
      <rect x="20" y="32" width="21" height="9" fill={color} />
    </svg>
  );
}

function Logo({ size = 44 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.3) }}>
      <Mark size={size} />
      <div style={{ fontSize: Math.round(size * 0.84), fontWeight: 800, letterSpacing: "-0.045em", color: ICE }}>HedgePredict</div>
    </div>
  );
}

/** The call bar: picked side lit, fair price gray, the other side dim. */
function Bar({ w }: { w: number }) {
  return (
    <div style={{ display: "flex", gap: 6, width: w, height: 14 }}>
      <div style={{ flex: 66, background: WAGER }} />
      <div style={{ flex: 26, background: "#4a5059" }} />
      <div style={{ flex: 8, background: "#2a2f36" }} />
    </div>
  );
}

const Footer = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>hedgepredict.co</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: SOFT }}>Free · Decision support, not financial advice</div>
  </div>
);

/** Headline left, a real-looking call card right. */
function CallCard() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: "60px 72px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48, flex: 1, paddingBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 470 }}>
          <Logo size={42} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, color: INK }}>
            <span>Find the price</span>
            <span style={{ color: ICE }}>that&apos;s off.</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.35, color: SOFT }}>Free calls on Polymarket US markets, in plain English.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 540, padding: "34px 36px", background: PANEL, border: `2px solid ${RULE}` }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.08em", color: SOFT }}>KENTUCKY VS. SOUTH CAROLINA</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 34 }}>
            <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 0.92, color: INK }}>43¢</div>
            <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 0.92, color: WAGER }}>Wager</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
            We like&nbsp;<span style={{ color: WAGER }}>Kentucky</span>&nbsp;at this price.
          </div>
          <Bar w={468} />
          <div style={{ fontSize: 22, fontWeight: 500, color: SOFT }}>66% sure it&apos;s too cheap</div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export async function renderOg() {
  const [bold, medium] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Inter-800.ttf")),
    readFile(join(process.cwd(), "src/app/fonts/Inter-500.ttf")),
  ]);
  return new ImageResponse(<CallCard />, {
    ...OG_SIZE,
    fonts: [
      { name: "Inter", data: bold, weight: 800, style: "normal" },
      { name: "Inter", data: medium, weight: 500, style: "normal" },
    ],
  });
}

/** A card for one real call (the /share/[id] link): the market, the leaned side's price, and the call. */
export interface CardCall {
  marketName: string;
  action: "wager" | "hold";
  side: { label: string; price: number };
}

function MarketCard({ read }: { read: CardCall }) {
  const side = read.side;
  const call = read.action === "wager" ? "Wager" : "Lean";
  const tone = read.action === "wager" ? WAGER : ICE;
  const yesNo = side.label === "Yes" || side.label === "No";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: "60px 72px" }}>
      <Logo size={42} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: "40px 44px", background: PANEL, border: `2px solid ${RULE}` }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: INK }}>{read.marketName}</div>
        {/* A Yes/No call puts its side in the big type ("Lean No"), same as the board; named sides keep the price first. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
          {yesNo ? (
            <>
              <div style={{ display: "flex", flexShrink: 0, fontSize: 104, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.92, color: tone }}>{`${call} ${side.label}`}</div>
              <div style={{ display: "flex", flexShrink: 0, marginLeft: 36, fontSize: 104, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.92, color: INK }}>{`${Math.round(side.price * 100)}¢`}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 0.92, color: INK }}>{`${Math.round(side.price * 100)}¢`}</div>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 0.92, color: tone }}>{call}</div>
            </>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
          Jev likes&nbsp;<span style={{ color: tone }}>{side.label}</span>&nbsp;at this price.
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.3, color: SOFT }}>
          {`The market gives ${side.label} ${Math.round(side.price * 100)}%. Jev thinks it's more likely than that.`}
        </div>
      </div>
      <Footer />
    </div>
  );
}

async function fonts() {
  const [bold, medium] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Inter-800.ttf")),
    readFile(join(process.cwd(), "src/app/fonts/Inter-500.ttf")),
  ]);
  return [
    { name: "Inter", data: bold, weight: 800 as const, style: "normal" as const },
    { name: "Inter", data: medium, weight: 500 as const, style: "normal" as const },
  ];
}

export async function renderMarketOg(read: CardCall) {
  return new ImageResponse(<MarketCard read={read} />, { ...OG_SIZE, fonts: await fonts() });
}
