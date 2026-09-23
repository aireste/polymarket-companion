"use client";

import { useState } from "react";
import type { PlayDTO } from "@/lib/dto";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useRecommendation } from "@/lib/useRecommendation";
import { pct, resolveAt, usd } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { Recommendation } from "./Recommendation";
import { EdgePanel } from "./EdgePanel";

const RANGES = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
];

/** The blown-up view for one market: live chart + data + edge/hedge tools. */
export function MarketDetail({ play }: { play: PlayDTO }) {
  const target = play.outcomes[0];
  const [range, setRange] = useState("1w");
  const { history, loading, error } = usePriceHistory(target?.tokenId, range);
  const {
    rec,
    loading: recLoading,
    error: recError,
    run: getRec,
  } = useRecommendation(play.id);

  const currentP =
    history && history.length > 0
      ? history[history.length - 1].p
      : target?.price ?? 0;
  const firstP = history && history.length > 0 ? history[0].p : currentP;
  const deltaPts = (currentP - firstP) * 100;

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-now">
          <span className="detail-pct num">{pct(currentP)}</span>
          <span className="detail-outcome">{target?.label}</span>
          {history && (
            <span className={`delta ${deltaPts >= 0 ? "up" : "down"}`}>
              {deltaPts >= 0 ? "▲" : "▼"} {Math.abs(deltaPts).toFixed(1)} pts
            </span>
          )}
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

      <div className="detail-chart">
        {loading && <div className="chart-skl" aria-hidden />}
        {!loading && error && (
          <div className="chart-empty">
            No price history for this market right now.
          </div>
        )}
        {!loading && !error && history && <PriceChart points={history} />}
      </div>

      <div className="detail-meta">
        {play.outcomes.slice(0, 4).map((o) => (
          <span className="odd" key={o.label}>
            {o.label}
            <b>{pct(o.price)}</b>
          </span>
        ))}
        <span className="detail-dot" aria-hidden>
          ·
        </span>
        <span>24h {usd(play.volume24hr)}</span>
        <span>liq {usd(play.liquidity)}</span>
        <span>Resolves {resolveAt(play.endDate)}</span>
      </div>

      <div className="rec-section">
        {!rec && !recLoading && recError !== "no-key" && (
          <button className="rec-cta-btn" onClick={getRec} disabled={recLoading}>
            <span className="rec-cta-lead">Should you play this?</span>
            <span className="rec-cta-sub">
              Claude checks the latest news &amp; sentiment, then calls it.
            </span>
            <span className="rec-cta-go">Get the play →</span>
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
            <code>ANTHROPIC_API_KEY</code>). You can still run your own numbers
            below.
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
      </div>

      <details className="manual">
        <summary>Prefer to run your own numbers?</summary>
        <EdgePanel play={play} />
      </details>
    </div>
  );
}
