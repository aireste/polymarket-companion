"use client";

import { useEffect, useState } from "react";
import { useBoard } from "@/lib/boardStore";
import { todaysPick } from "@/lib/pick";
import { JEV_ACTION_COPY, confidenceLabel } from "@/lib/jevDisplay";
import { selectMarket } from "@/lib/useSelection";
import { pct, price } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Countdown } from "./Countdown";
import { Icon } from "./icons";
import { useOddsFormat } from "@/lib/oddsFormat";
import { polymarketUs } from "@/lib/links";

const KEY = "hp_pick_collapsed";

/**
 * The board's "start here": Jev's strongest call today, as a slim dark band
 * (desktop) or a card (phone). "Open" focuses it in the inspector / sheet.
 */
export function TodaysPick({ variant, onOpen }: { variant: "desk" | "phone"; onOpen?: (id: string) => void }) {
  const fmt = useOddsFormat();
  const { plays, reads, jevStatus, sparks } = useBoard();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* default open */
    }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {
        /* session only */
      }
      return !c;
    });
  };

  if (!plays || (jevStatus === "loading" && Object.keys(reads).length === 0)) {
    return <div className={`hp-pick hp-pick-${variant} is-loading`} aria-hidden />;
  }

  const pick = todaysPick(plays, reads);
  const open = (id: string) => (onOpen ? onOpen(id) : selectMarket(id));

  if (!pick) {
    return (
      <section className={`hp-pick hp-pick-${variant} is-empty`} aria-label="Today's pick">
        <span className="hp-pick-k">Today&apos;s pick</span>
        <p>
          <b>No standout play right now.</b> Today&apos;s board looks fairly priced. That&apos;s a real answer: check back as prices move.
        </p>
      </section>
    );
  }

  const { play, read } = pick;
  const side = read.sides[read.lean!];
  const a = JEV_ACTION_COPY[read.action];
  const verb = read.action === "wager" ? "Back" : "Lean";
  const conf = confidenceLabel(read.confidence);
  // Chart the side being recommended: for the second side of a binary market,
  // its price is 1 minus the first side's.
  const base = sparks[play.outcomes[0]?.tokenId ?? ""];
  const sideSeries = read.lean === 1 && base ? base.map((pt) => ({ t: pt.t, p: 1 - pt.p })) : base;

  if (variant === "desk" && collapsed) {
    return (
      <button className="hp-pick hp-pick-desk is-collapsed" onClick={toggle} aria-expanded={false}>
        <span className="hp-pick-k">Today&apos;s pick</span>
        <span className="hp-pick-mini">
          {verb} <b>{side.label}</b> at {price(side.price, fmt)} · {play.question}
        </span>
        <span className="hp-pick-show">Show ▾</span>
      </button>
    );
  }

  return (
    <section className={`hp-pick hp-pick-${variant} featured`} aria-label="Today's pick">
      {variant === "desk" && (
        <button className="hp-pick-hide" onClick={toggle} aria-label="Collapse today's pick">
          Hide ▴
        </button>
      )}
      <div className="hp-pick-main">
        <div className="hp-pick-top">
          <span className="hp-pick-k">
            <span className="hp-pick-spark">{Icon.spark}</span>
            Today&apos;s pick
          </span>
          <span className={`hp-pick-tag ${a.cls}`}>
            {a.label}
          </span>
        </div>
        <h2 className="hp-pick-head">
          {verb} <em>{side.label}</em> at <span className="num">{price(side.price, fmt)}</span>
        </h2>
        <p className="hp-pick-q">{play.question}</p>
        <p className="hp-pick-meta">
          {pct(read.strength, 0)} sure it&apos;s too cheap{conf ? ` · ${conf} confidence` : ""} ·{" "}
          <Countdown play={play} />
        </p>
      </div>

      <div className="hp-pick-side">
        {variant === "desk" && (
          <span className="hp-pick-trend">
            <Sparkline points={sideSeries} width={150} height={34} />
            <small>1W · {side.label}</small>
          </span>
        )}
        <div className="hp-pick-lean" aria-label="How the call splits">
          {read.sides.length === 2 ? (
            <>
              <i className={read.lean === 0 ? `on ${a.cls}` : ""} style={{ flexGrow: Math.max(read.distribution.sides[0], 0.02) }} />
              <i className="n" style={{ flexGrow: Math.max(read.distribution.neither, 0.02) }} />
              <i className={read.lean === 1 ? `on ${a.cls}` : ""} style={{ flexGrow: Math.max(read.distribution.sides[1], 0.02) }} />
            </>
          ) : (
            read.sides.map((_, i) => (
              <i key={i} className={read.lean === i ? `on ${a.cls}` : ""} style={{ flexGrow: Math.max(read.distribution.sides[i], 0.02) }} />
            ))
          )}
        </div>
        <div className="hp-pick-actions">
          <button className="hp-pick-open" onClick={() => open(play.id)}>
            Open
          </button>
          <a className="hp-pick-trade" href={polymarketUs(play.question)} target="_blank" rel="noopener noreferrer">
            <span className="hp-pm-tile">{Icon.polymarket}</span>
            Trade ↗
          </a>
        </div>
      </div>
    </section>
  );
}
