"use client";

import type { RecommendationDTO } from "@/lib/dto";
import { pct, timingLabel } from "@/lib/format";

const ACTION_COPY: Record<
  RecommendationDTO["aiAction"],
  { label: string; blurb: string; cls: string }
> = {
  CHASE: {
    label: "Chase",
    blurb: "Clear value worth acting on now.",
    cls: "chase",
  },
  HOLD: {
    label: "Hold",
    blurb: "Some edge, but wait or watch.",
    cls: "hold",
  },
  SKIP: {
    label: "Skip",
    blurb: "No clear edge, or too risky.",
    cls: "skip",
  },
};

export function Recommendation({
  rec,
  url,
}: {
  rec: RecommendationDTO;
  url?: string;
}) {
  const a = ACTION_COPY[rec.aiAction];
  const target = rec.currentOdds[0];
  const marketPct = target ? pct(target.price, 0) : "—";

  return (
    <div className="rec">
      <div className="rec-head">
        <span className={`rec-badge ${a.cls}`}>{a.label}</span>
        <div className="rec-head-txt">
          <div className="rec-blurb">{a.blurb}</div>
          <div className="rec-conf">{rec.confidence} confidence</div>
        </div>
      </div>

      <div className="rec-read">
        <span className="rec-read-k">Claude&apos;s read</span>
        <span className="rec-read-v num">
          {pct(rec.aiProbability, 0)}
          <span className="rec-read-vs"> · market {marketPct}</span>
          {target ? ` on ${target.label}` : ""}
        </span>
      </div>

      <div className="rec-block">
        <div className="rec-block-k">Why</div>
        <p>{rec.actionRationale}</p>
      </div>

      <div className="rec-block">
        <div className="rec-block-k">Live crowd sentiment</div>
        <p>{rec.crowdSentimentSummary}</p>
      </div>

      <div className="rec-foot">
        <span className="rec-model" style={{ textTransform: "capitalize" }}>
          {timingLabel(rec.gameStartTime, rec.endDate)} · {rec.model} · live web search
        </span>
        {url && (
          <a
            className="rec-cta"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Trade on Polymarket ↗
          </a>
        )}
      </div>
    </div>
  );
}
