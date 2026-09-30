"use client";

import { useState } from "react";

/**
 * A plain-language "What is Jev?" explainer for non-technical visitors. Collapsed
 * by default (a single quiet link) so it never clutters the page for returning
 * users; expands inline right where they meet the "Ask Jev" button. No jargon.
 */
const POINTS: { k: string; p: string }[] = [
  {
    k: "It reads the numbers for you",
    p: "Jev looks at each market's current prices, how they moved over the last week and day, how much money is trading, and when it resolves. You do not need to crunch anything yourself.",
  },
  {
    k: "It gives you a straight call",
    p: "It answers one question: at these prices, is either side a bargain? Wager means it's fairly sure one side is too cheap, Lean means it thinks a side might be, Skip means both prices look fair. The percentages show how sure Jev is, not the chance of winning; the prices are the crowd's odds.",
  },
  {
    k: "It is honest about no-edge",
    p: "The market price already reflects the crowd's best guess, so Jev often says the price is about right. That is on purpose: it keeps you from betting on what is really a fair coin flip.",
  },
  {
    k: "Jev decides, Claude explains",
    p: "Open any market for the call. Then tap “Why does Jev say that?”, or use Ask HedgePredict, to have Claude explain it in plain English and check the latest news.",
  },
];

export function WhatIsJev() {
  const [open, setOpen] = useState(false);

  return (
    <div className={`whatis${open ? " open" : ""}`}>
      <button
        type="button"
        className="whatis-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="whatis-q">New here? What is Jev?</span>
        <span className="whatis-chev" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && (
        <div className="whatis-body">
          <p className="whatis-lead">
            Jev is the brain behind HedgePredict. Think of it as a sharp odds
            analyst that reads a market and tells you, plainly, whether there is
            a smart bet here.
          </p>

          <ul className="whatis-points">
            {POINTS.map((pt) => (
              <li key={pt.k}>
                <span className="whatis-k">{pt.k}</span>
                <span className="whatis-p">{pt.p}</span>
              </li>
            ))}
          </ul>

          <p className="whatis-safe">
            Jev is decision support, not financial advice. It never places
            trades. Only risk what you can afford to lose.
          </p>
        </div>
      )}
    </div>
  );
}
