"use client";

const STEPS = [
  {
    n: 1,
    h: "Browse today's markets",
    p: "Use the side tabs (Today, Hot, Coin-flips, Soon) or the stat cards to filter live Polymarket markets down to the ones worth a look.",
  },
  {
    n: 2,
    h: "Open one for the read",
    p: "Tap any market for its live odds and signal: momentum, liquidity, how close to 50/50, and time to resolution. Enter your own probability or tap Ask Claude to get the edge, a suggested stake, and the hedge.",
  },
  {
    n: 3,
    h: "Or just ask",
    p: "Use Ask HedgePredict to ask anything in plain English, like “best coin-flips today?” It reads live markets, checks the news, and does the edge math for you.",
  },
  {
    n: 4,
    h: "Take it to your own AI",
    p: "Connect HedgePredict to Claude, Claude Code, or ChatGPT with the MCP endpoint, and let your assistant call the same engine. See “Use in your own AI” below.",
  },
];

export function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <section className="guide" aria-label="How HedgePredict works">
      <div className="guide-top">
        <h2>How HedgePredict works</h2>
        <button className="guide-close" onClick={onClose} aria-label="Dismiss guide">
          ✕
        </button>
      </div>

      <div className="guide-steps">
        {STEPS.map((s) => (
          <div className="gstep" key={s.n}>
            <div className="n">{s.n}</div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </div>
        ))}
      </div>

      <div className="guide-foot">
        <span className="safe">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="4.5" y="10.5" width="15" height="9" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" strokeLinecap="round" />
          </svg>
          No login, no wallet, nothing connected to your accounts. It only reads
          public data and never places trades.
        </span>
        <button className="pill pill-dark" onClick={onClose}>
          Got it
        </button>
      </div>
    </section>
  );
}
