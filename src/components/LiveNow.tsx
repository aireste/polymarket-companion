"use client";

import type { PlayDTO } from "@/lib/dto";
import { pct, isLive } from "@/lib/format";

/**
 * A highlight strip of games that are on right now. Renders only when there's
 * something live, so it never sits empty. Cards link out to Polymarket, in
 * keeping with the "read here, trade there" model.
 */
export function LiveNow({ plays }: { plays: PlayDTO[] }) {
  const live = plays.filter((p) => isLive(p.gameStartTime));
  if (live.length === 0) return null;

  return (
    <section className="livenow" aria-label="Live now">
      <div className="livenow-head">
        <span className="livenow-title">
          <span className="livenow-dot" aria-hidden />
          Live now
        </span>
        <span className="livenow-count">
          {live.length} game{live.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="livenow-row">
        {live.map((p) => (
          <a
            key={p.id}
            className="livecard"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="livecard-q">{p.question}</span>
            <span className="livecard-odds">
              {p.outcomes.slice(0, 2).map((o) => (
                <span className="lc-odd" key={o.label}>
                  {o.label} <b>{pct(o.price, 0)}</b>
                </span>
              ))}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
