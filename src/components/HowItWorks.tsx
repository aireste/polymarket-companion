"use client";

import Link from "next/link";
import { useState } from "react";
import { price, type OddsFormat } from "@/lib/format";
import { useOddsFormat } from "@/lib/oddsFormat";

/**
 * How it works, short and structured: what HedgePredict is, the three calls
 * (the one thing to learn), how to use it in three steps, the two numbers,
 * then the FAQ. Example prices follow the viewer's ¢ / US setting.
 */
/** The walkthrough: one example market per call, told in three beats. */
type Scene = {
  cls: "wager" | "hold" | "skip";
  word: string;
  q: string;
  side: string;
  other: string;
  price: number;
  dist: [number, number, number]; // side a bargain / fair price / other side a bargain, out of 100
  meaning: string;
  beats: (p: string) => [string, string][];
};

const SCENES: Scene[] = [
  {
    cls: "wager", word: "Wager", q: "China Open: Molcan vs Rinderknech", side: "Molcan", other: "Rinderknech", price: 0.5, dist: [74, 22, 4],
    meaning: "We like Molcan at this price.",
    beats: (p) => [
      ["What it says", `Molcan looks too cheap at ${p}. Out of 100 reads, 74 call Molcan a bargain.`],
      ["How sure", "74% sure, medium confidence. Wager is the strongest call HedgePredict makes, and the only one in green."],
      ["What to do", "Worth a real look. If you agree, open it on Polymarket. You always make the final call."],
    ],
  },
  {
    cls: "hold", word: "Lean", q: "Will Norway win on Oct 1?", side: "Yes", other: "No", price: 0.42, dist: [43, 54, 3],
    meaning: "Yes looks a little cheap. Not a strong play.",
    beats: (p) => [
      ["What it says", `Yes looks a little cheap at ${p}, but only 43 of 100 reads agree. Most of the rest say the price is fair.`],
      ["How sure", "43% sure, low confidence. Amber means a hunch, not a strong play."],
      ["What to do", "Keep an eye on it. A Lean can turn into a Wager, or a Skip, as the price moves."],
    ],
  },
  {
    cls: "skip", word: "Skip", q: "Will the Fed raise rates in October?", side: "Yes", other: "No", price: 0.34, dist: [18, 64, 18],
    meaning: "Priced fair. Sit this one out.",
    beats: () => [
      ["What it says", "The price looks fair. 64 of 100 reads say neither side is a bargain."],
      ["How sure", "64% sure both prices are fair. Gray means there's no edge to find here."],
      ["What to do", "Nothing to do. Most prices are fair, so you'll see Skip a lot, and sitting out is a real answer."],
    ],
  },
];

/**
 * Wager, Lean and Skip as a stepper: the reader taps a tab to move,
 * nothing advances on its own. The current tab is lit in its
 * call color; tabs already passed get a full bar in theirs. Each scene is an
 * example market with its call, the bar, and what it means.
 */
function CallTour({ fmt }: { fmt: OddsFormat }) {
  const [i, setI] = useState(0);
  const s = SCENES[i];
  const p = price(s.price, fmt);
  const lit = s.cls === "skip" ? 1 : 0;

  return (
    <div className={`tour is-${s.cls}`}>
      <div className="tour-tabs" role="tablist" aria-label="The three calls">
        {SCENES.map((x, n) => (
          <button key={x.word} role="tab" aria-selected={n === i} className={`is-${x.cls}${n < i ? " is-done" : ""}`} onClick={() => setI(n)}>
            {x.word}
            <i>
              <b />
            </i>
          </button>
        ))}
      </div>

      <div className="tour-body" key={i}>
        <div className="tour-card" aria-label={`Example: ${s.q}`}>
          <p className="tour-q">{s.q}</p>
          <div className="tour-nums">
            <div>
              <b className="num">{p}</b>
              <small>{s.side} price</small>
            </div>
            <div className="tour-call">
              <b>{s.word}</b>
              <small>{s.meaning}</small>
            </div>
          </div>
          <div className="tour-bar" aria-hidden>
            {s.dist.map((d, n) => (
              <i key={n} className={n === lit ? "lit" : n === 1 ? "fair" : ""} style={{ flexGrow: d }} />
            ))}
          </div>
          <div className="tour-lbls">
            <span className={lit === 0 ? "lit" : ""}>
              <b>{s.dist[0]}%</b> {s.side} a bargain
            </span>
            <span className={lit === 1 ? "lit" : "fair"}>
              <b>{s.dist[1]}%</b> Fair price
            </span>
            <span>
              <b>{s.dist[2]}%</b> {s.other} a bargain
            </span>
          </div>
        </div>
        <dl className="tour-beats">
          {s.beats(p).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

    </div>
  );
}

const STEPS = [
  { t: "Pick a market", d: "Games, elections, crypto and more, sorted by when they resolve. Search finds anything else." },
  { t: "Read the call", d: "Wager, Lean or Skip, with how sure HedgePredict is. Calls update as prices move." },
  { t: "Ask why", d: "Tap \u201cWhy this call?\u201d for a plain explanation, or ask HedgePredict anything." },
];

/** Plain answers to what people actually ask. Example odds follow the ¢ / US toggle. */
function FAQ(fmt: OddsFormat): { q: string; a: React.ReactNode }[] {
  return [
    {
      q: "Where do the calls come from?",
      a: "HedgePredict looks at each market's price, how it has moved over the last day and week, how much money is trading, and when it ends. From that it flags the sides that look too cheap.",
    },
    {
      q: "Is 74% the chance my side wins?",
      a: "No. It's how sure HedgePredict is that a side is priced too cheap. The chance of winning is the price itself: what the crowd on Polymarket thinks.",
    },
    {
      q: "Why do I see Skip so often?",
      a: "Because most prices are fair. The crowd usually gets it about right, so HedgePredict only says Wager or Lean when a side genuinely looks cheap.",
    },
    {
      q: "What are American odds, and what does the ¢ / US switch do?",
      a: (
        <>
          Sportsbooks like DraftKings and FanDuel show odds like +150 or −163. Polymarket shows prices in cents. They mean the same thing: a{" "}
          {price(0.4, "poly")} price is {price(0.4, "us")}, and {price(0.62, "poly")} is {price(0.62, "us")}. The switch at the top changes every price in
          the app and remembers your choice{fmt === "us" ? " (you're on US odds now)" : ""}.
        </>
      ),
    },
    {
      q: "Does HedgePredict place bets or need my wallet?",
      a: "No. There's no login and no wallet, and nothing is connected to your accounts. When you want to act on a call, the Trade button searches for that market on Polymarket US, the regulated US exchange. Not every market is listed there.",
    },
    {
      q: "How fresh are the prices?",
      a: "They update about every 20 seconds while the board is open. All times are US Eastern, the same as Polymarket.",
    },
    {
      q: "What's a deep read?",
      a: (
        <>
          A deep read checks the latest news and what people are saying online about a market, next to the call. They&apos;re free when you join{" "}
          <Link href="/daily">The Daily</Link>, up to 3 a day.
        </>
      ),
    },
    {
      q: "What is The Daily?",
      a: (
        <>
          A 2-minute email every weekday at 8 AM ET with the day&apos;s best pick, what&apos;s ending soon, and the biggest movers.{" "}
          <Link href="/daily">See today&apos;s issue</Link>.
        </>
      ),
    },
    {
      q: "Can I use HedgePredict inside ChatGPT or Claude?",
      a: (
        <>
          Yes. You can connect HedgePredict to the AI assistant you already use and ask it for calls there. <Link href="/connect">Here&apos;s how</Link>.
        </>
      ),
    },
    {
      q: "What's Jev?",
      a: "Jev is the engine under the hood: a decision model, built on TypeSafe, that makes HedgePredict's calls from each market's numbers. The plain-English explanations and news checks are written with AI. You never need to think about either; the call is what matters.",
    },
    {
      q: "Is this financial advice?",
      a: "No. HedgePredict helps you see what the prices say and where they might be off. You make the call, and you should only stake what you're comfortable losing.",
    },
  ];
}

export function HowItWorks() {
  const fmt = useOddsFormat();

  return (
    <article className="hw">
      <header className="hw-hero">
        <span className="hw-k">How it works</span>
        <h1>Your prediction market assistant.</h1>
        <p>
          HedgePredict watches the markets, points out the plays worth a closer look, and tells you why in plain English. Whether you
          bet on DraftKings and FanDuel or already trade on Polymarket.
        </p>
        <div className="hw-cta">
          <Link className="hw-btn" href="/">
            Open the board
          </Link>
          <Link className="hw-btn ghost" href="/ask">
            Ask a question
          </Link>
        </div>
      </header>

      <section className="hw-sec" aria-labelledby="hw-calls">
        <h2 id="hw-calls">Every market gets one of three calls</h2>
        <CallTour fmt={fmt} />
      </section>

      <section className="hw-sec" aria-labelledby="hw-use">
        <h2 id="hw-use">How to use it</h2>
        <ol className="hw-steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span>{i + 1}</span>
              <b>{s.t}</b>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="hw-sec" aria-labelledby="hw-two">
        <h2 id="hw-two">Two numbers, two meanings</h2>
        <div className="hw-two">
          <div>
            <span className="hw-big num">{price(0.5, fmt)}</span>
            <b>The price</b>
            <p>What the crowd on Polymarket thinks. Flip the ¢ / US switch at the top to see sportsbook odds.</p>
          </div>
          <div>
            <span className="hw-big num">74%</span>
            <b>How sure we are</b>
            <p>How sure HedgePredict is that a side is too cheap. It is not the chance of winning.</p>
          </div>
        </div>
      </section>

      <section className="hw-sec" aria-labelledby="hw-faq">
        <h2 id="hw-faq">Questions</h2>
        <div className="hw-faq">
          {FAQ(fmt).map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span aria-hidden>+</span>
              </summary>
              <div className="hw-faq-a">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      <footer className="hw-foot">
        <p>
          We built HedgePredict to do the homework: watch every market, point out the plays worth a look, and explain them like a friend
          would. Hope it helps you find better plays. <b>The team at HedgePredict</b>
        </p>
        <p className="hw-safe">No login, no wallet, nothing connected to your accounts. HedgePredict only reads public data and never places trades.</p>
      </footer>
    </article>
  );
}
