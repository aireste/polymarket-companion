"use client";

import Link from "next/link";
import { price, type OddsFormat } from "@/lib/format";
import { useOddsFormat } from "@/lib/oddsFormat";

/**
 * How it works, written so anyone can follow it: what to tap, what the call
 * means, how to get the most out of it. No engine names or model talk; the
 * FAQ has one line for the curious. Each step carries a small replica of the
 * screen it describes, and example prices follow the viewer's ¢ / US setting.
 */
const BOARD = [
  { q: "Will the Fed raise rates in October?", p: 0.335, call: "Skip", cls: "skip" },
  { q: "China Open: Molcan vs Rinderknech", p: 0.5, call: "Wager", side: "Molcan", cls: "wager" },
  { q: "Will Norway win on Oct 1?", p: 0.685, call: "Lean", side: "Yes", cls: "hold" },
];

const TIPS = [
  { t: "Start with Wagers", d: "Wager is the strongest call. Lean is a softer hunch. If you only look at a few, look at those." },
  { t: "Skip is a good answer", d: "Most prices are fair. A Skip saves you from betting on what's really a coin flip." },
  { t: "Check back as prices move", d: "Calls update with the price. A side that's cheap this morning might not be tonight." },
  { t: "Use the odds you know", d: "Flip the ¢ / US switch at the top to see every price as sportsbook odds, like +150 or −163." },
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
    <article className="hiw">
      <header className="hiw-hero">
        <span className="hiw-eyebrow">Welcome to HedgePredict</span>
        <h1>Your prediction market assistant.</h1>
        <p>
          Whether you bet on DraftKings and FanDuel or already trade on Polymarket, you&apos;re in the right place. HedgePredict
          watches the markets for you, points out the plays worth a closer look, and tells you why in plain English.
        </p>
      </header>

      <h2 className="hiw-sec">How it works</h2>
      <ol className="hiw-steps">
        <li className="hiw-card">
          <span className="hiw-n">01</span>
          <h2>Pick something you care about</h2>
          <p>The board lists today&apos;s games, elections, crypto prices and more. Tap any one to open it. Live shows games happening right now, and search finds anything else.</p>
          <div className="hiw-demo hiw-board" aria-hidden>
            {BOARD.map((r) => (
              <div className="hiw-row" key={r.q}>
                <span className="hiw-q">{r.q}</span>
                <span className="hiw-p">{price(r.p, fmt, "pct", 0)}</span>
                <span className={`hiw-call ${r.cls}`}>
                  {r.call}
                  {r.side && <small> · {r.side}</small>}
                </span>
              </div>
            ))}
          </div>
        </li>

        <li className="hiw-card">
          <span className="hiw-n">02</span>
          <h2>Check the call</h2>
          <p>Every market gets one of three calls. Wager: we like one side at this price. Lean: one side looks a little cheap. Skip: the price looks fair, so sit it out.</p>
          <div className="hiw-demo hiw-dark" aria-hidden>
            <span className="hiw-k">
              HedgePredict&apos;s call <b>Wager</b> <small>· medium confidence</small>
            </span>
            <strong>Back Alex Molcan.</strong>
            <span className="hiw-sub">74% sure Molcan is too cheap at {price(0.5, fmt)}</span>
          </div>
        </li>

        <li className="hiw-card">
          <span className="hiw-n">03</span>
          <h2>See the reason</h2>
          <p>Tap &ldquo;Why this call?&rdquo; for a short, plain explanation. Want more before you decide? A deep read checks the latest news.</p>
          <div className="hiw-demo" aria-hidden>
            <div className="hiw-bar">
              <i style={{ width: "74%" }} />
              <i style={{ width: "22%" }} />
              <i style={{ width: "4%" }} />
            </div>
            <div className="hiw-legend">
              <span><b>74%</b> Molcan is a bargain</span>
              <span><b>22%</b> Fair price</span>
              <span><b>4%</b> Other side</span>
            </div>
            <div className="hiw-chips">
              <span>Why this call?</span>
              <span>Deep read</span>
            </div>
          </div>
        </li>

        <li className="hiw-card">
          <span className="hiw-n">04</span>
          <h2>Or just ask</h2>
          <p>Not sure where to start? Type a question the way you&apos;d ask a friend, and get a straight answer back.</p>
          <div className="hiw-demo" aria-hidden>
            <span className="hiw-bubble me">Any good coin-flips today?</span>
            <span className="hiw-bubble">HedgePredict leans Norway at {price(0.685, fmt)}. The other two look fairly priced.</span>
          </div>
        </li>
      </ol>

      <section className="hiw-tips" aria-label="Getting the most out of it">
        <h2>Getting the most out of it</h2>
        <div className="hiw-tips-grid">
          {TIPS.map((t) => (
            <div key={t.t}>
              <b>{t.t}</b>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hiw-two" aria-label="Reading the numbers">
        <h2>Two numbers, two meanings</h2>
        <div className="hiw-two-grid">
          <div>
            <span className="hiw-big">{price(0.5, fmt)}</span>
            <b>The price</b>
            <p>What the crowd on Polymarket thinks. Switch between cents and sportsbook odds with the ¢ / US switch at the top.</p>
          </div>
          <div>
            <span className="hiw-big">74%</span>
            <b>How sure we are</b>
            <p>How sure HedgePredict is that a side is too cheap. It is not the chance of winning.</p>
          </div>
        </div>
      </section>

      <section className="hiw-faq" aria-labelledby="hiw-faq-h">
        <div className="hiw-faq-side">
          <h2 id="hiw-faq-h">FAQ</h2>
          <p>Still wondering about something? Ask HedgePredict, it knows the board.</p>
        </div>
        <div className="hiw-faq-list">
          {FAQ(fmt).map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span aria-hidden>+</span>
              </summary>
              <div className="hiw-faq-a">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="hiw-note" aria-label="Why we built HedgePredict">
        <h2>Why we built this</h2>
        <p>
          Prediction markets move fast, and it&apos;s hard to tell a good price from a coin flip. We wanted a sidekick that does the
          homework: watches every market, points out the plays worth a look, and explains them like a friend would. So we built
          one, plus a few things we wanted ourselves: the Hedge Lab for running your own numbers, a way to use HedgePredict inside
          your own AI, and The Daily for a pick with your morning coffee.
        </p>
        <p>Hope it helps you find better plays.</p>
        <span className="hiw-sign">The team at HedgePredict</span>
      </section>

      <p className="hiw-safe">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="4.5" y="10.5" width="15" height="9" rx="2" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" strokeLinecap="round" />
        </svg>
        No login, no wallet, nothing connected to your accounts. HedgePredict only reads public data and never places trades.
      </p>
    </article>
  );
}
