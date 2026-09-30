"use client";

const STEPS = [
  {
    n: 1,
    h: "Browse today's markets",
    p: "The board ranks live Polymarket markets by signal. Use Today, Live, Hot and Coin-flips to narrow it down, or search all of Polymarket with ⌘K (the search bar on your phone).",
  },
  {
    n: 2,
    h: "Ask Jev for the call",
    p: "Jev is HedgePredict's calibrated prediction engine: a decision model, not a chatbot. Jev looks at each market's prices, recent price moves, volume and timing, and answers one question: at these prices, is either side underpriced? Wager means it picks a side outright, Lean means it leans one way, Skip means the prices look about right. Open any market to see the bar: how sure Jev is that each side is too cheap, or that the price is fair. Those percentages are Jev's confidence, not chances of winning; the prices (in ¢) are the crowd's odds.",
  },
  {
    n: 3,
    h: "Get the why, or a deeper read",
    p: "Once Jev has called it, tap “Why does Jev say that?” for a plain-English explanation of the numbers, or “Deep read” to pull the live news and sentiment behind the call (3 a day). Prefer your own math? “Run your own numbers” and the Hedge Lab are one tap away.",
  },
  {
    n: 4,
    h: "Ask in plain English, or use your own AI",
    p: "Ask HedgePredict anything, like “best coin-flips today?”, and Jev makes the verdicts while Claude does the talking. Or connect the same engine to Claude, Claude Code, or ChatGPT with the MCP endpoint below.",
  },
];

export function HowItWorks({ onClose }: { onClose?: () => void }) {
  return (
    <section className="guide" aria-label="How HedgePredict works">
      <div className="guide-top">
        <h2>How HedgePredict works</h2>
        {onClose && (
          <button className="guide-close" onClick={onClose} aria-label="Dismiss guide">
            ✕
          </button>
        )}
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
        {onClose && (
          <button className="pill pill-dark" onClick={onClose}>
            Got it
          </button>
        )}
      </div>
    </section>
  );
}
