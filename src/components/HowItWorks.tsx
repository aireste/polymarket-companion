"use client";

import Link from "next/link";
import { price, type OddsFormat } from "@/lib/format";
import { useOddsFormat } from "@/lib/oddsFormat";
import { TourPlayer, TOUR_AT, playTourAt } from "./TourPlayer";

/**
 * How it works, short and structured: what HedgePredict is, the voiced tour
 * (the calls, odds, Hedge Lab, the Daily, your AI), the same tour as a short
 * text list (each row jumps the video to its chapter), then the FAQ. Example prices follow the viewer's ¢ / US setting.
 */
/** The tour in text, one row per chapter, for people who'd rather skim. Prices follow the ¢ / US setting. */
function TOUR_TEXT(fmt: OddsFormat): { tab: string; t: string; d: string }[] {
  return [
    {
      tab: "Prices",
      t: "The price is the odds",
      d: `A ${price(0.43, fmt)} price means about a 43% chance. Win, and each share pays $1: your 43¢ back plus 57¢ profit. Flip ¢ / US at the top for sportsbook odds (${price(0.43, "us")}).`,
    },
    { tab: "Calls", t: "Every market gets a call", d: "Wager when a side looks too cheap, Lean when it's a mild tilt, Skip when the price looks about right." },
    { tab: "How sure", t: "How sure we are", d: "\u201c74% sure\u201d is how sure HedgePredict is that a side is priced too cheap. It is not the chance of winning." },
    { tab: "Hedge Lab", t: "Hedge Lab", d: "Already holding a bet? See how much to put on the other side to lock in a result either way." },
    { tab: "The Daily", t: "The Daily", d: "The day's top pick, what resolves soon and the biggest movers, in your inbox weekdays at 8 AM ET." },
    { tab: "Search & Ask", t: "Search & Ask", d: "Search any market on Polymarket, or ask HedgePredict about one in plain English." },
    { tab: "Connect AI", t: "Connect your AI", d: "Use HedgePredict inside Claude, ChatGPT or any MCP app with one link." },
  ];
}

/** Chapter timestamps on the text rows, like the player's clock. */
const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

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
        <h2 id="hw-use">The tour, in 20 seconds</h2>
        <ol className="hw-tour">
          {TOUR_TEXT(fmt).map((r) => (
            <li key={r.tab}>
              <b>{r.t}</b>
              <p>{r.d}</p>
              <button type="button" className="hw-at num" onClick={() => playTourAt(r.tab)} aria-label={`Play the tour from ${r.t}`}>
                ▶ {mmss(TOUR_AT[r.tab])}
              </button>
            </li>
          ))}
        </ol>
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
          We built HedgePredict to do the homework: check the top markets, point out where there could be true value, and explain them like a friend
          would. Hope it helps you find better plays. <b>The team at HedgePredict</b>
        </p>
        <p className="hw-safe">No login, no wallet, nothing connected to your accounts. HedgePredict only reads public data and never places trades.</p>
      </footer>
    </article>
  );
}
