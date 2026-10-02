"use client";

import Link from "next/link";
import { price, type OddsFormat } from "@/lib/format";
import { useOddsFormat } from "@/lib/oddsFormat";
import { TourPlayer } from "./TourPlayer";

/**
 * How it works, short and structured: what HedgePredict is, the voiced tour
 * (the calls, odds, Hedge Lab, the Daily, your AI), how to use it in three
 * steps, the two numbers, then the FAQ. Example prices follow the viewer's ¢ / US setting.
 */
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
        <h1>Your prediction market assistant.</h1>
        <p>
          HedgePredict watches the markets, points out the plays worth a closer look, and tells you why in plain English. Whether you
          bet on DraftKings and FanDuel or already trade on Polymarket.
        </p>
      </header>

      <TourPlayer />

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
