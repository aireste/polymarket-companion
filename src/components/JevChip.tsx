"use client";

import type { JevReadDTO } from "@/lib/dto";
import { pct } from "@/lib/format";
import { JEV_ACTION_COPY, confidenceLabel } from "@/lib/jevDisplay";

interface JevState {
  jev: JevReadDTO | null;
  loading: boolean;
  error: string | null;
}

/**
 * Glanceable calibrated read: "Jev · SKIP · 67% · high". Purely presentational
 * — the parent owns the useJev call so a row and its expanded card share one
 * fetch. Renders nothing when Jev isn't configured or errored, so rows stay
 * clean; a pulsing placeholder shows while the fast call is in flight.
 */
export function JevChip({ state }: { state: JevState }) {
  const { jev, loading, error } = state;

  if (loading && !jev) {
    return (
      <span className="jev-chip jev-chip-loading" aria-hidden>
        <span className="jev-mark">Jev</span>
        <span className="jev-dots">reading…</span>
      </span>
    );
  }
  // No key or a transient error: stay invisible rather than clutter the row.
  if (error || !jev) return null;

  const a = JEV_ACTION_COPY[jev.action];
  const conf = confidenceLabel(jev.confidence);

  return (
    <span
      className={`jev-chip jev-${a.cls}`}
      title={`Jev's calibrated read: ${a.label} on ${jev.outcome}. ${a.blurb}`}
    >
      <span className="jev-mark">Jev</span>
      <span className="jev-action">{a.label}</span>
      <span className="jev-sep" aria-hidden>
        ·
      </span>
      <span className="jev-prob num">{pct(jev.jevProbability, 0)}</span>
      {conf && (
        <>
          <span className="jev-sep" aria-hidden>
            ·
          </span>
          <span className="jev-conf">{conf}</span>
        </>
      )}
    </span>
  );
}
