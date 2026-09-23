"use client";

import { useState } from "react";
import { analyzePlay } from "@/lib/scoring";
import type { PlayDTO, ReadResponse } from "@/lib/dto";
import { pct, usd } from "@/lib/format";

/**
 * Plain-language edge finder. The user says how likely they think the outcome
 * really is (a slider, or "Ask Claude" fills it), and tells us their total
 * risk budget. We compare their view to the market, pick the side with the
 * edge, and suggest a small capped stake plus a hedge. No jargon on screen.
 */
export function EdgePanel({ play }: { play: PlayDTO }) {
  const yes = play.outcomes[0];
  const no = play.outcomes[1];
  const marketYes = yes?.price ?? 0;
  const playable = marketYes > 0 && marketYes < 1;

  // belief = user's % chance for the FIRST outcome. Starts at the market price
  // (so edge starts at zero until they move it or ask Claude).
  const [belief, setBelief] = useState<number>(
    Math.min(99, Math.max(1, Math.round(marketYes * 100)))
  );
  const [risk, setRisk] = useState(50);
  const [read, setRead] = useState<ReadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myYes = belief / 100;

  // Pick whichever side the user's view favors, so the suggestion is always
  // for the side that has the edge.
  const sideIsYes = myYes >= marketYes;
  const sideLabel = sideIsYes ? yes?.label : no?.label ?? "the other side";
  const sidePrice = sideIsYes ? marketYes : 1 - marketYes;
  const sideProb = sideIsYes ? myYes : 1 - myYes;

  let analysis: ReturnType<typeof analyzePlay> | null = null;
  if (playable && sidePrice > 0 && sidePrice < 1 && risk >= 0) {
    try {
      analysis = analyzePlay({
        marketPrice: sidePrice,
        yourProbability: sideProb,
        bankroll: risk,
      });
    } catch {
      analysis = null;
    }
  }
  const edgePts = analysis ? analysis.edgePoints : 0;
  const noEdge = !analysis || edgePts < 1;

  async function askClaude() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(play),
      });
      const data = (await res.json()) as ReadResponse | { error: string };
      if ("error" in data) {
        setError(data.error);
      } else {
        setRead(data);
        if (data.available) {
          setBelief(
            Math.min(99, Math.max(1, Math.round(data.probability * 100)))
          );
        }
      }
    } catch {
      setError("Could not reach Claude right now.");
    } finally {
      setLoading(false);
    }
  }

  if (!playable) {
    return (
      <div className="ask">
        <p className="helper">
          This market sits at {pct(marketYes)} on {yes?.label} right now, which is
          too lopsided to size a sensible play.
        </p>
      </div>
    );
  }

  return (
    <div className="ask">
      <div>
        <p className="ask-q">
          How likely do you really think “{yes?.label}” is?
        </p>
        <div className="belief">
          <span className="belief-v num">{belief}%</span>
          <span className="belief-ref num">
            market says {pct(marketYes, 0)}
          </span>
        </div>
        <input
          type="range"
          className="slider"
          min={1}
          max={99}
          value={belief}
          onChange={(e) => setBelief(Number(e.target.value))}
          aria-label={`Your estimated chance of ${yes?.label}`}
        />
      </div>

      <div className="ask-actions">
        <button className="btn btn-accent" onClick={askClaude} disabled={loading}>
          {loading ? "Claude is thinking…" : "Not sure? Ask Claude"}
        </button>
        {read && read.available && (
          <span className="conf">Claude: {pct(read.probability, 0)} · {read.confidence} confidence</span>
        )}
      </div>

      {error && <p className="helper" style={{ color: "var(--neg-ink)" }}>{error}</p>}
      {read && read.available && (
        <p className="read-note" style={{ marginTop: 0 }}>{read.rationale}</p>
      )}
      {read && !read.available && (
        <p className="helper">
          Add an Anthropic API key to enable Claude reads. For now, set the slider yourself.
        </p>
      )}

      <div className="risk-row">
        <div className="risk-field">
          <label className="risk-label" htmlFor={`risk-${play.id}`}>
            How much would you risk in total?
          </label>
          <div className="risk-input">
            <span>$</span>
            <input
              id={`risk-${play.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={5}
              value={risk}
              onChange={(e) => setRisk(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="helper" style={{ maxWidth: "18rem" }}>
          We suggest a small, safe slice of this, never the whole amount.
        </p>
      </div>

      {analysis && (
        <div className="result">
          {noEdge ? (
            <div className="result-verdict skip">
              No clear edge, skip this one.
            </div>
          ) : (
            <>
              <div className="result-verdict go">Lean {sideLabel}</div>
              <div className="result-grid">
                <div className="result-stat">
                  <div className="k">Your edge</div>
                  <div className="v" style={{ color: "var(--pos-ink)" }}>
                    +{edgePts.toFixed(1)} pts
                  </div>
                </div>
                <div className="result-stat">
                  <div className="k">Suggested wager</div>
                  <div className="v">{usd(analysis.suggestedStake)}</div>
                </div>
                <div className="result-stat">
                  <div className="k">On</div>
                  <div className="v">
                    {sideLabel} @ {pct(sidePrice, 0)}
                  </div>
                </div>
              </div>
              <p className="result-hedge">{analysis.hedge.note}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
