"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useRecommendation } from "@/lib/useRecommendation";
import { useJev } from "@/lib/useJev";
import { useJevExplain } from "@/lib/useJevExplain";
import { JEV_ACTION_COPY, confidenceLabel } from "@/lib/jevDisplay";
import { pct, resolveAt, usd } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { Recommendation } from "./Recommendation";
import { EdgePanel } from "./EdgePanel";
import { JevPill } from "./JevPill";
import { Status } from "./Status";
import { Icon } from "./icons";

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
export function Inspector({ play }: { play: PlayDTO }) {
  const { now } = useBoard();
  return (
    <div className="hp-insp-body" key={play.id}>
      <header className="hp-insp-head">
        <Status play={play} now={now} icon />
        <h2>{play.question}</h2>
      </header>
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
        <a className="pill pill-dark" href={play.url} target="_blank" rel="noopener noreferrer">
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
  const current = history?.length ? history[history.length - 1].p : target?.price ?? 0;
  const first = history?.length ? history[0].p : current;
  const delta = (current - first) * 100;
  const others = play.outcomes.slice(1, 4);

  return (
    <section className="featured hp-price" aria-label="Price">
      <div className="featured-top">
        <div className="featured-num">
          <span className="featured-pct num">{pct(current)}</span>
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

  const a = JEV_ACTION_COPY[read.action];
  const conf = confidenceLabel(read.confidence);
  const edge = read.edge * 100;
  const probs = read.actionProbabilities ?? {};
  const words = { wager: "Worth a play.", hold: "Hold for now.", skip: "Skip it." }[read.action];

  return (
    <section className="hp-verdict" aria-label="Jev's call">
      <div className="hp-verdict-row">
        <span className="hp-verdict-k">Jev&apos;s call on {read.outcome}</span>
        <JevPill id={play.id} long />
      </div>
      <div className="hp-verdict-call">{words}</div>
      <div className="hp-verdict-sub">
        {a.blurb}
        {conf && ` ${conf[0].toUpperCase()}${conf.slice(1)} confidence.`}
      </div>
      <dl className="hp-vs">
        <div>
          <dt>Jev</dt>
          <dd>{pct(read.jevProbability, 0)}</dd>
        </div>
        <div>
          <dt>Market</dt>
          <dd>{pct(read.marketPrice)}</dd>
        </div>
        <div>
          <dt>Edge</dt>
          <dd className={edge >= 0 ? "pos" : "neg"}>
            {edge >= 0 ? "+" : ""}
            {edge.toFixed(1)}
          </dd>
        </div>
      </dl>
      <div className="hp-dist" aria-label="How strongly Jev leans">
        {(["wager", "hold", "skip"] as const).map((k) => {
          const v = Math.round((probs[k] ?? 0) * 100);
          return (
            <div className={`hp-dist-row${k === read.action ? " win" : ""}`} key={k}>
              <span>{k}</span>
              <span className="hp-dist-track">
                <i style={{ width: `${v}%` }} />
              </span>
              <span>{v}%</span>
            </div>
          );
        })}
      </div>

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
  if (error === "no-key") return null;
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
