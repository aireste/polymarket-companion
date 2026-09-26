"use client";

import type { JevReadDTO } from "@/lib/dto";
import { pct } from "@/lib/format";
import { useJevExplain } from "@/lib/useJevExplain";
import {
  JEV_ACTION_COPY,
  confidenceLabel,
  valuationLabel,
  edgeLabel,
} from "@/lib/jevDisplay";

interface JevState {
  jev: JevReadDTO | null;
  loading: boolean;
  error: string | null;
}

/**
 * The fuller Jev read for an expanded market: the calibrated verdict, edge vs
 * the market, and an on-demand "Why does Jev say that?" that hands the read to
 * Claude for a plain-language explanation. Jev makes the call; Claude narrates.
 */
export function JevCard({
  state,
  onAsk,
}: {
  state: JevState;
  onAsk?: () => void;
}) {
  const { jev, loading, error } = state;
  const explain = useJevExplain(jev);

  // Jev not configured: don't advertise a broken feature.
  if (error === "no-key" && !jev) return null;

  if (loading && !jev) {
    return (
      <div className="jev-card jev-card-loading">
        <span className="rec-spinner" aria-hidden />
        <span>Jev is reading the numbers…</span>
      </div>
    );
  }

  // Idle: Jev is on-demand, so lead with the action — a plain "What's the call?"
  // banner with the green Ask Jev button right in it.
  if (!jev && !error && onAsk) {
    return (
      <div className="jev-ask-banner">
        <div className="jev-ask-banner-txt">
          <span className="jev-ask-banner-lead">
            <span className="jev-mark jev-ask-card-mark">Jev</span>
            What&apos;s the call?
          </span>
          <span className="jev-ask-banner-sub">
            A calibrated read on this play: wager, hold, or skip.
          </span>
        </div>
        <button type="button" className="jev-ask-btn" onClick={onAsk}>
          Ask Jev →
        </button>
      </div>
    );
  }

  if (error && error !== "no-key" && !jev) {
    return (
      <p className="helper" style={{ color: "var(--neg-ink)" }}>
        {error === "busy"
          ? "Jev is in high demand right now (the model is briefly rate-limited upstream)."
          : "Jev couldn't be reached right now."}{" "}
        {onAsk && (
          <button className="linklike" onClick={onAsk}>
            Try again
          </button>
        )}
      </p>
    );
  }

  if (!jev) return null;

  const a = JEV_ACTION_COPY[jev.action];
  const conf = confidenceLabel(jev.confidence);

  return (
    <div className="jev-card">
      <div className="jev-card-head">
        <span className={`jev-chip jev-${a.cls}`}>
          <span className="jev-mark">Jev</span>
          <span className="jev-action">{a.label}</span>
        </span>
        <div className="jev-card-headtxt">
          <div className="jev-card-blurb">{a.blurb}</div>
          <div className="jev-card-sub">
            calibrated model · numbers only{conf ? ` · ${conf} confidence` : ""}
          </div>
        </div>
      </div>

      <div className="jev-read">
        <span className="jev-read-k">Jev&apos;s read</span>
        <span className="jev-read-v num">
          {pct(jev.jevProbability, 0)}
          <span className="jev-read-vs">
            {" "}
            · market {pct(jev.marketPrice, 0)}
          </span>{" "}
          on {jev.outcome}
        </span>
        <span className={`jev-edge ${jev.edge >= 0 ? "up" : "down"}`}>
          {edgeLabel(jev.edge)} · {valuationLabel(jev.valuation)}
        </span>
      </div>

      {!explain.explanation && explain.error !== "no-key" && (
        <button
          className="jev-why"
          onClick={explain.run}
          disabled={explain.loading}
        >
          {explain.loading ? (
            <>
              <span className="rec-spinner" aria-hidden /> Claude is explaining…
            </>
          ) : (
            "Why does Jev say that? →"
          )}
        </button>
      )}
      {explain.error === "no-key" && (
        <p className="helper">
          The plain-language explainer needs an Anthropic API key (set{" "}
          <code>ANTHROPIC_API_KEY</code>).
        </p>
      )}
      {explain.error && explain.error !== "no-key" && (
        <p className="helper" style={{ color: "var(--neg-ink)" }}>
          {explain.error}{" "}
          <button className="linklike" onClick={explain.run}>
            Try again
          </button>
        </p>
      )}
      {explain.explanation && (
        <div className="jev-explain">
          <div className="jev-explain-k">Why Jev says {a.label.toLowerCase()}</div>
          <p>{explain.explanation}</p>
          {explain.model && (
            <span className="jev-explain-model">{explain.model}</span>
          )}
        </div>
      )}
    </div>
  );
}
