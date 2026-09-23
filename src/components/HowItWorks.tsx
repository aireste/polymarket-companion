"use client";

const STEPS = [
  {
    n: 1,
    h: "Browse today's markets",
    p: "Use the side tabs — Today, Hot, Coin-flips, Soon — to filter live Polymarket markets down to the ones worth a look.",
  },
  {
    n: 2,
    h: "Open one to see why",
    p: "Tap any market for its live odds and signal: momentum, liquidity, how close to 50/50, and how soon it resolves.",
  },
  {
    n: 3,
    h: "Find the edge & hedge",
    p: "Enter your own probability or tap Ask Claude, then see the edge, a suggested stake on your bankroll, and the opposing leg to hedge.",
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
