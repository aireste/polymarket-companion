"use client";

import { useBoard } from "@/lib/boardStore";
import { JEV_ACTION_COPY } from "@/lib/jevDisplay";

/** Jev's verdict for a row: "Skip 25%". Quiet placeholder while the board read loads. */
export function JevPill({ id, long = false }: { id: string; long?: boolean }) {
  const { reads, jevStatus } = useBoard();
  const read = reads[id];
  if (!read) {
    if (jevStatus === "loading") return <span className="hp-jev hp-jev-pending" aria-label="Jev is reading" />;
    return <span className="hp-jev hp-jev-none">{jevStatus === "offline" ? "Jev off" : "Jev ·"}</span>;
  }
  const a = JEV_ACTION_COPY[read.action];
  return (
    <span className={`hp-jev hp-jev-${a.cls}`} title={`Jev: ${a.label}, ${Math.round(read.jevProbability * 100)}% on ${read.outcome}`}>
      <span className="hp-jev-dot" aria-hidden />
      {long ? `Jev · ${a.label}` : a.label} {Math.round(read.jevProbability * 100)}%
    </span>
  );
}
