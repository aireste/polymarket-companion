"use client";

import { useBoard } from "@/lib/boardStore";
import { JEV_ACTION_COPY, leanSide, shortSide } from "@/lib/jevDisplay";

/**
 * Jev's call on a row: "Wager · Colts", "Lean · Yes", or "Skip". A quiet
 * shimmer while the board read loads.
 */
export function JevPill({ id, long = false }: { id: string; long?: boolean }) {
  const { reads, jevStatus } = useBoard();
  const read = reads[id];
  if (!read) {
    if (jevStatus === "loading") return <span className="hp-jev hp-jev-pending" aria-label="Jev is reading" />;
    return <span className="hp-jev hp-jev-none">{jevStatus === "offline" ? "Jev off" : "Jev ·"}</span>;
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
      title={side ? `Jev: ${a.label} ${side.label} (${pct}% on that side)` : `Jev: priced about right (${pct}%)`}
    >
      <span className="hp-jev-dot" aria-hidden />
      {long && "Jev · "}
      {a.label}
      {side && <span className="hp-jev-side">{shortSide(side.label, long ? 22 : 12)}</span>}
    </span>
  );
}
