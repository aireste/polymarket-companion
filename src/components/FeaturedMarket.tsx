"use client";

import { useState } from "react";
import type { PlayDTO } from "@/lib/dto";
import { useCountUp } from "@/lib/useCountUp";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useRecommendation } from "@/lib/useRecommendation";
import { useJev } from "@/lib/useJev";
import { timingLabel, isLive, usd } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { JevChip } from "./JevChip";
import { JevCard } from "./JevCard";
import { WhatIsJev } from "./WhatIsJev";
import { Recommendation } from "./Recommendation";

const RANGES: { id: string; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
];

export function FeaturedMarket({ play }: { play: PlayDTO }) {
  const target = play.outcomes[0];
  const token = target?.tokenId;

  const [range, setRange] = useState("1w");
  const { history, loading, error } = usePriceHistory(token, range);

  const currentP =
    history && history.length > 0
      ? history[history.length - 1].p
      : target?.price ?? 0;
  const firstP = history && history.length > 0 ? history[0].p : currentP;
  const deltaPts = (currentP - firstP) * 100;
  const shownPct = useCountUp(currentP * 100);

  const {
    rec,
    loading: recLoading,
    error: recError,
    run: getRec,
  } = useRecommendation(play.id);

  const jevState = useJev(play.id);

  return (
    <>
    <section className="featured" aria-label="Featured market">
      <div className="featured-top">
        <div className="featured-lead">
          <span className="featured-eyebrow">Top signal today</span>
          <h2 className="featured-q">
            {isLive(play.gameStartTime) && <span className="live-badge">LIVE</span>}
            {play.question}
          </h2>
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

      <div className="featured-num">
        <span className="featured-pct num">{shownPct.toFixed(1)}%</span>
        <span className="featured-outcome">{target?.label}</span>
        {history && (
          <span
            className={`delta ${deltaPts >= 0 ? "up" : "down"}`}
            title={`Change over ${range.toUpperCase()}`}
          >
            {deltaPts >= 0 ? "▲" : "▼"} {Math.abs(deltaPts).toFixed(1)} pts
          </span>
        )}
        <JevChip state={jevState} />
      </div>

      <div className="featured-chart">
        {loading && <div className="chart-skl" aria-hidden />}
        {!loading && error && (
          <div className="chart-empty">
            Price history isn&apos;t available for this market right now.
          </div>
        )}
        {!loading && !error && history && <PriceChart points={history} />}
      </div>

      <div className="featured-foot">
        <span className="featured-meta num">
          24h {usd(play.volume24hr)} · liq {usd(play.liquidity)}
          {!isLive(play.gameStartTime) && ` · ${timingLabel(play.gameStartTime, play.endDate)}`}
        </span>
        <a
          className="featured-link"
          href={play.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on Polymarket ↗
        </a>
      </div>
    </section>

    <section className="featured-rec" aria-label="AI recommendation">
      <WhatIsJev />
      <JevCard state={jevState} onAsk={jevState.run} />
      {jevState.jev && !rec && !recLoading && recError !== "no-key" && (
        <button
          className="rec-cta-btn secondary"
          onClick={getRec}
          disabled={recLoading}
        >
          <span className="rec-cta-lead">Want the deeper read?</span>
          <span className="rec-cta-sub">
            Jev already made the call above. Have Claude check live news &amp;
            sentiment for the story behind it (~15s).
          </span>
          <span className="rec-cta-go">Get Claude&apos;s web read →</span>
        </button>
      )}
      {recLoading && (
        <div className="rec-loading">
          <span className="rec-spinner" aria-hidden />
          Reading live news &amp; sentiment… this takes ~15 seconds.
        </div>
      )}
      {recError === "no-key" && (
        <p className="helper">
          AI recommendations need an Anthropic API key (set{" "}
          <code>ANTHROPIC_API_KEY</code>).
        </p>
      )}
      {recError && recError !== "no-key" && (
        <p className="helper" style={{ color: "var(--neg-ink)" }}>
          {recError}{" "}
          <button className="linklike" onClick={getRec}>
            Try again
          </button>
        </p>
      )}
      {rec && <Recommendation rec={rec} url={play.url} />}
    </section>
    </>
  );
}
