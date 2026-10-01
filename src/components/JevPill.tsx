"use client";

import { useBoard } from "@/lib/boardStore";
import { JEV_ACTION_COPY, leanSide, shortSide } from "@/lib/jevDisplay";

/**
 * Jev's call on a row: "Wager · Colts", "Lean · Yes", or "Skip". Plain type:
 * weight and ink carry the strength of the call, no dots or chips.
 */
export function JevPill({ id, long = false }: { id: string; long?: boolean }) {
  const { reads, jevStatus } = useBoard();
  const read = reads[id];
  if (!read) {
    if (jevStatus === "loading") return <span className="hp-jev hp-jev-none" aria-label="Reading">…</span>;
    return <span className="hp-jev hp-jev-none">{jevStatus === "offline" ? "Off" : "·"}</span>;
  }
  if (read.settled) {
    return (
      <span className="hp-jev hp-jev-none" title="Effectively decided: one side is at 97% or more">
        Decided
      </span>
    );
  }
  const a = JEV_ACTION_COPY[read.action];
  const side = leanSide(read);
  const pct = Math.round(read.strength * 100);
  return (
    <span
      className={`hp-jev hp-jev-${a.cls}`}
      title={side ? `${a.label} ${side.label}: ${pct}% sure it's too cheap` : `Both prices look fair (${pct}% sure)`}
    >
      {a.label}
      {side && <span className="hp-jev-side">{shortSide(side.label, long ? 22 : 12)}</span>}
    </span>
  );
}
