"use client";

const STEPS = [
  {
    n: 1,
    h: "Browse today's markets",
    p: "Use the side tabs (Today, Hot, Coin-flips, Live) or the stat cards to filter live Polymarket markets down to the ones worth a look.",
  },
  {
    n: 2,
    h: "Ask Jev for the call",
    p: "Jev is HedgePredict's calibrated prediction engine — a decision model, not a chatbot. Tap “Ask Jev” on the featured pick or any market row and it instantly returns the play: wager, hold, or skip, plus its own probability, the edge versus the market price, and a confidence score.",
  },
  {
    n: 3,
    h: "Get the why, or a deeper read",
    p: "Once Jev has called it, tap “Why does Jev say that?” for a plain-English explanation of the numbers, or “Claude's web read” to pull the live news and sentiment behind the call. Prefer your own math? The edge + hedge calculator is one tap away.",
  },
  {
    n: 4,
    h: "Ask in plain English, or use your own AI",
    p: "Ask HedgePredict anything — “best coin-flips today?” — and Jev makes the verdicts while Claude does the talking. Or connect the same engine to Claude, Claude Code, or ChatGPT with the MCP endpoint below.",
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
