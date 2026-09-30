"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JevReadDTO, PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useRecommendation } from "@/lib/useRecommendation";
import { useJev } from "@/lib/useJev";
import { useJevExplain } from "@/lib/useJevExplain";
import { JEV_ACTION_COPY, confidenceLabel, leanSide, shortSide } from "@/lib/jevDisplay";
import { cents, clockLabel, pct, resolveAt, usd } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { Recommendation } from "./Recommendation";
import { EdgePanel } from "./EdgePanel";
import { JevPill } from "./JevPill";
import { Status } from "./Status";
import { Icon } from "./icons";
import { Odo } from "./Odo";
import { SubscribeBox, useJoinedDaily } from "./SubscribeBox";

const RANGES = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
];

/**
 * Everything about one market: the dark price centerpiece, Jev's call, the
 * optional deep read, and the numbers. Desktop shows it as the right-hand
 * inspector; the phone shows the same thing inside a bottom sheet.
 */
export function Inspector({ play, pass = false }: { play: PlayDTO; pass?: boolean }) {
  const { now } = useBoard();
  return (
    <div className="hp-insp-body" key={play.id}>
      <header className="hp-insp-head">
        <Status play={play} now={now} icon />
        <h2>{play.question}</h2>
      </header>
      {pass && <JevPass play={play} />}
      <PriceCard play={play} />
      <JevVerdict play={play} />
      <DeepRead play={play} />
      <dl className="hp-stats">
        <div>
          <dt>{play.gameStartTime ? "Starts" : "Resolves"}</dt>
          <dd>{resolveAt(play.gameStartTime ?? play.endDate)}</dd>
        </div>
        <div>
          <dt>24h volume</dt>
          <dd>{usd(play.volume24hr)}</dd>
        </div>
        <div>
          <dt>Liquidity</dt>
          <dd>{usd(play.liquidity)}</dd>
        </div>
        <div>
          <dt>All-time volume</dt>
          <dd>{usd(play.volume)}</dd>
        </div>
      </dl>
      <div className="hp-insp-actions">
        <a className="pill pill-dark hp-pm-btn" href={play.url} target="_blank" rel="noopener noreferrer">
          <span className="hp-pm-tile">{Icon.polymarket}</span>
          Open on Polymarket ↗
        </a>
        <Link className="pill" href="/hedge">
          <span className="hp-ico-sm">{Icon.hedge}</span>
          Hedge calculator
        </Link>
      </div>
      <details className="manual">
        <summary>Run your own numbers</summary>
        <EdgePanel play={play} />
      </details>
      <p className="hp-disc">
        Decision support, not financial advice. HedgePredict never places trades.
      </p>
    </div>
  );
}

function PriceCard({ play }: { play: PlayDTO }) {
  const target = play.outcomes[0];
  const [range, setRange] = useState("1w");
  const { history, loading, error } = usePriceHistory(target?.tokenId, range);
  // The big number is the live price (polled every 20s); history is for the line.
  const current = target?.price ?? (history?.length ? history[history.length - 1].p : 0);
  const first = history?.length ? history[0].p : current;
  const delta = (current - first) * 100;
  const others = play.outcomes.slice(1, 4);

  return (
    <section className="featured hp-price" aria-label="Price">
      <div className="featured-top">
        <div className="featured-num">
          <span className="featured-pct num"><Odo value={pct(current)} /></span>
          <span className="featured-outcome">{target?.label}</span>
        </div>
        <div className="range" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              className={`range-btn${range === r.id ? " active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {history && (
        <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts over {range.toUpperCase()}
        </span>
      )}
      <div className="featured-chart">
        {loading && <div className="chart-skl" aria-hidden />}
        {!loading && error && <div className="chart-empty">No price history for this market yet.</div>}
        {!loading && !error && history && <PriceChart points={history} />}
      </div>
      <div className="featured-foot">
        <span className="featured-meta num">
          {others.map((o) => `${o.label} ${pct(o.price)}`).join(" · ")}
        </span>
        <a className="featured-link" href={play.url} target="_blank" rel="noopener noreferrer">
          Polymarket ↗
        </a>
      </div>
    </section>
  );
}

/** Jev's call. Board markets arrive pre-read; anything else is one tap away. */
function JevVerdict({ play }: { play: PlayDTO }) {
  const { reads, jevStatus, setRead } = useBoard();
  const shown = useMounted();
  const manual = useJev(play.id);
  const read = reads[play.id] ?? manual.jev;
  const explain = useJevExplain(read ?? null);

  useEffect(() => {
    if (manual.jev) setRead(manual.jev);
  }, [manual.jev, setRead]);

  if (!read) {
    if (jevStatus === "loading" || manual.loading) {
      return (
        <div className="hp-verdict hp-verdict-wait">
          <span className="rec-spinner" aria-hidden /> Jev is reading the numbers…
        </div>
      );
    }
    if (jevStatus === "offline" || manual.error === "no-key") {
      return <div className="hp-verdict hp-verdict-wait">Jev is offline on this server (no TypeSafe key).</div>;
    }
    return (
      <div className="hp-verdict hp-verdict-ask">
        <div>
          <div className="hp-verdict-k">Jev</div>
          <div className="hp-verdict-lead">What&apos;s the call?</div>
          {manual.error && <p className="helper">Jev couldn&apos;t be reached. Try again.</p>}
        </div>
        <button className="pill hp-pill-lime" onClick={manual.run}>
          Ask Jev →
        </button>
      </div>
    );
  }

  if (read.settled) {
    return (
      <section className="hp-verdict" aria-label="Jev's call">
        <span className="hp-verdict-k">Jev&apos;s call</span>
        <div className="hp-verdict-call">Effectively decided.</div>
        <div className="hp-verdict-sub">One side is already at 97% or more, so there&apos;s nothing left for Jev to call.</div>
      </section>
    );
  }
  const conf = confidenceLabel(read.confidence);
  const side = leanSide(read);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const headline =
    read.action === "wager" ? `Back ${side?.label}.` : read.action === "hold" ? `Leans ${side?.label}.` : "Priced about right.";

  return (
    <section className="hp-verdict" aria-label="Jev's call">
      {/* The headline already names the side; the header just states the call, quietly. */}
      <div className="hp-verdict-row">
        <span className="hp-verdict-k">Jev&apos;s call</span>
        <span className={`hp-call hp-call-${JEV_ACTION_COPY[read.action].cls}`}>
          <i aria-hidden />
          {JEV_ACTION_COPY[read.action].label}
          {conf && <small>{conf} confidence</small>}
        </span>
      </div>
      <div className="hp-verdict-call">{headline}</div>
      <div className="hp-verdict-sub">
        {!side
          ? `Jev is ${pct(read.strength)} sure both prices are fair.`
          : read.action === "wager"
            ? `Jev is ${pct(read.strength)} sure ${side.label} is too cheap at ${cents(side.price)}.`
            : `Jev thinks ${side.label} looks a bit cheap at ${cents(side.price)}, but it's only ${pct(read.strength)} sure.`}
      </div>
      <LeanBar read={read} shown={shown} />
      <p className="hp-verdict-src">
        These are Jev&apos;s confidence in each answer, not chances of winning. One side being a bargain means the other is overpriced.
        Jev reads price action, volume and timing; Deep read adds the news.
      </p>

      {!explain.explanation && explain.error !== "no-key" && (
        <button className="hp-link" onClick={explain.run} disabled={explain.loading}>
          {explain.loading ? "Claude is explaining…" : "Why does Jev say that?"}
        </button>
      )}
      {explain.error && explain.error !== "no-key" && (
        <p className="helper">
          {explain.error}{" "}
          <button className="linklike" onClick={explain.run}>
            Try again
          </button>
        </p>
      )}
      {explain.explanation && (
        <div className="hp-explain">
          <p>{explain.explanation}</p>
          {explain.model && <span>{explain.model}</span>}
        </div>
      )}
    </section>
  );
}

/** The slower Claude + live-news read. Optional, and only after Jev has spoken. */
function DeepRead({ play }: { play: PlayDTO }) {
  const { rec, loading, error, run } = useRecommendation(play.id);
  const joined = useJoinedDaily();
  if (error === "no-key") return null;
  // Lead gen: deep reads are free for Daily readers. (A browser-side gate; the
  // server's 3-per-day limit still protects cost either way.)
  if (!joined && !rec) {
    return (
      <div className="hp-deep-lock">
        <SubscribeBox
          compact
          source="deep-read-unlock"
          title="Unlock deep reads"
          blurb="Claude checks the live news behind any market (~15s). Free for HedgePredict Daily readers: join and it unlocks right away."
        />
      </div>
    );
  }
  const limited = error?.startsWith("You've used today's") ?? false;
  if (rec) return <Recommendation rec={rec} url={play.url} />;
  if (loading) {
    return (
      <div className="rec-loading">
        <span className="rec-spinner" aria-hidden />
        Reading live news &amp; sentiment… about 15 seconds.
      </div>
    );
  }
  return (
    <div className="hp-deep">
      <div>
        <div className="hp-deep-lead">Want the story behind the numbers?</div>
        <div className="hp-deep-sub">Claude checks live news and sentiment (~15s). 3 per day.</div>
        {error && (
          <p className="helper" style={{ color: limited ? "var(--ink-soft)" : "var(--neg-ink)" }}>
            {error}
          </p>
        )}
      </div>
      {!limited && (
        <button className="pill" onClick={run}>
          {error ? "Try again" : "Deep read"}
        </button>
      )}
    </div>
  );
}

/** True one frame after mount, so bars and markers animate in from zero. */
function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return on;
}

/**
 * Jev's answer as one stacked bar: each side's share of "this side is
 * underpriced" with "priced about right" in the middle. The leaned side is lit.
 */
/**
 * Natural-frequency version of the bar, which people read more easily than
 * percentages: "If Jev read this market 100 times, it would call Yes a
 * bargain 45 times, the price fair 53 times, and No a bargain 2 times."
 */
function freqSentence(order: { key: string; label: string; p: number }[]) {
  const parts = order.map((g) => {
    const n = Math.round(g.p * 100);
    const what = g.key === "n" ? "the price fair" : `${g.label.replace(/ is a bargain$/, "")} a bargain`;
    return `${what} ${n} ${n === 1 ? "time" : "times"}`;
  });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}` : parts[0];
  return `If Jev read this market 100 times, it would call ${list}.`;
}

function LeanBar({ read, shown }: { read: JevReadDTO; shown: boolean }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const segs = read.sides.map((s, i) => ({ key: `s${i}`, label: `${s.label} is a bargain`, sub: `trades at ${cents(s.price)}`, p: read.distribution.sides[i] ?? 0, lean: read.lean === i }));
  const neither = { key: "n", label: "Fair price", sub: "", p: read.distribution.neither, lean: read.lean == null };
  // Two-sided markets read left side / neither / right side; others put neither last.
  const order = segs.length === 2 ? [segs[0], neither, segs[1]] : [...segs, neither];
  const tone = read.action === "wager" ? "wager" : read.action === "hold" ? "hold" : "skip";
  return (
    <div className="hp-lean" aria-label="How Jev's answer splits">
      <div className="hp-lean-q">Is either side a bargain at these prices?</div>
      <div className="hp-lean-bar">
        {order.map((g) => (
          <i
            key={g.key}
            className={`${g.key === "n" ? "is-n" : ""} ${g.lean ? `is-lean ${tone}` : ""}`}
            style={{ flexGrow: shown ? Math.max(g.p, 0.015) : 1 }}
          />
        ))}
      </div>
      <div className="hp-lean-lbls">
        {order.map((g) => (
          <span key={g.key} className={g.lean ? "is-lean" : undefined}>
            <b>{pct(g.p)}</b> {g.label}
            {g.sub && <small>{g.sub}</small>}
          </span>
        ))}
      </div>
      <p className="hp-lean-freq">{freqSentence(order)}</p>
    </div>
  );
}

/** Phone sheet header, boarding-pass style: the side at its market price → Jev's lean. */
export function JevPass({ play }: { play: PlayDTO }) {
  const { reads } = useBoard();
  const r = reads[play.id];
  if (!r || r.settled) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const side = leanSide(r);
  const [s0, s1] = r.sides;
  const a = JEV_ACTION_COPY[r.action];
  return (
    <section className="hp-pass" aria-label="Jev's read">
      <div className="hp-pass-top">
        <span className="hp-verdict-k">Jev&apos;s read</span>
        <JevPill id={play.id} />
      </div>
      <div className="hp-pass-codes">
        <div>
          <small>{side ? shortSide(side.label, 16).toUpperCase() : shortSide(s0.label, 16).toUpperCase()}</small>
          <b>{cents(side ? side.price : s0.price)}</b>
        </div>
        <div className="hp-pass-arc">
          <span className={r.action === "skip" ? "" : "up"}>{side ? `${pct(r.strength)} sure it's cheap` : "fair price"}</span>
          <svg viewBox="0 0 100 40" aria-hidden>
            <path d="M2 36 Q50 -8 98 36" />
            <circle r="3.5">
              <animateMotion dur="2.4s" repeatCount="indefinite" path="M2 36 Q50 -8 98 36" />
            </circle>
          </svg>
        </div>
        <div>
          <small>{side ? "JEV" : shortSide(s1?.label ?? "", 16).toUpperCase()}</small>
          <b>{side ? a.label.toUpperCase() : cents(s1?.price ?? 0)}</b>
        </div>
      </div>
      <div className="hp-pass-foot">
        <span>
          CALL<b>{side ? `${a.label} ${shortSide(side.label, 12)}` : "Skip"}</b>
        </span>
        <span>
          CONFIDENCE<b>{r.confidence == null ? "–" : pct(r.confidence)}</b>
        </span>
        <span>
          RESOLVES<b>{clockLabel(play)}</b>
        </span>
      </div>
    </section>
  );
}
