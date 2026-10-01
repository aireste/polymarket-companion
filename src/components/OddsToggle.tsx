"use client";

import { setOddsFormat, useOddsFormat } from "@/lib/oddsFormat";

/** Polymarket cents vs US sportsbook odds (+150 / -163). */
export function OddsToggle() {
  const fmt = useOddsFormat();
  const opts = [
    { id: "poly", label: "¢", title: "Polymarket prices (cents / %)" },
    { id: "us", label: "US", title: "American odds, like DraftKings or FanDuel" },
  ] as const;
  return (
    <div className="range hp-oddsfmt" role="radiogroup" aria-label="Odds format">
      {opts.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={fmt === o.id}
          title={o.title}
          className={`range-btn${fmt === o.id ? " active" : ""}`}
          onClick={() => setOddsFormat(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
