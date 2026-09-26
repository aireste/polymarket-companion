"use client";

import type { PlayDTO } from "@/lib/dto";
import { pct, timingLabel, isLive, usd } from "@/lib/format";
import { useJev } from "@/lib/useJev";
import { SignalMeter } from "./SignalMeter";
import { JevChip } from "./JevChip";
import { MarketDetail } from "./MarketDetail";

/**
 * One market: a glanceable row. Controlled open state (single-open accordion)
 * so only the active market is blown up; the rest stay minimized.
 */
export function PlayEntry({
  play,
  rank,
  isOpen,
  onToggle,
}: {
  play: PlayDTO;
  rank: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `market-${play.id}`;
  // One Jev call per market, shared by the row chip and the expanded card.
  const jevState = useJev(play.id);

  return (
    <li className={`play${isOpen ? " open" : ""}`}>
      <button
        type="button"
        className="play-head"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="play-rank">{String(rank).padStart(2, "0")}</span>

        <span className="play-main">
          <span className="play-q">
            {isLive(play.gameStartTime) && <span className="live-badge">LIVE</span>}
            {play.question}
          </span>
          <span className="play-odds">
            {play.outcomes.slice(0, 4).map((o) => (
              <span className="odd" key={o.label}>
                {o.label}
                <b>{pct(o.price, 1)}</b>
              </span>
            ))}
          </span>
          <span className="play-meta">
            <JevChip state={jevState} onAsk={jevState.run} />
            <span>24h {usd(play.volume24hr)}</span>
            <span>liq {usd(play.liquidity)}</span>
            {!isLive(play.gameStartTime) && (
              <span>{timingLabel(play.gameStartTime, play.endDate)}</span>
            )}
          </span>
        </span>

        <span className="play-aside">
          <SignalMeter signals={play.signals} />
          <span className="chev">▶</span>
        </span>
      </button>

      {isOpen && (
        <div className="expand" id={panelId}>
          <MarketDetail play={play} jevState={jevState} />
        </div>
      )}
    </li>
  );
}
