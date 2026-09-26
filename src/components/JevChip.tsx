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
 * Glanceable calibrated read: "Jev · SKIP · 67% · high". Presentational — the
 * parent owns the useJev call so a row and its expanded card share one fetch.
 * Jev is on-demand: when nothing has loaded yet, an `onAsk` handler renders a
 * tappable "Ask Jev" pill; without one, the idle chip renders nothing (so the
 * surface stays clean until the verdict is requested elsewhere).
 */
export function JevChip({
  state,
  onAsk,
}: {
  state: JevState;
  onAsk?: () => void;
}) {
  const { jev, loading, error } = state;

  if (loading && !jev) {
    return (
      <span className="jev-chip jev-chip-loading" aria-hidden>
        <span className="jev-mark">Jev</span>
        <span className="jev-dots">reading…</span>
      </span>
    );
  }

  // Idle (nothing requested yet): offer an "Ask Jev" pill if the parent gave a
  // trigger, otherwise stay invisible.
  if (!jev && !error) {
    if (!onAsk) return null;
    return (
      <button
        type="button"
        className="jev-chip jev-ask"
        onClick={(e) => {
          e.stopPropagation();
          onAsk();
        }}
        title="Ask Jev for its calibrated call on this market"
      >
        <span className="jev-mark">Jev</span>
        <span className="jev-ask-txt">Ask →</span>
      </button>
    );
  }
  // Visible (muted) failure state instead of vanishing, so a missing gateway
  // key or a transient error is diagnosable at a glance rather than a mystery.
  // "busy" = the Jev model is briefly rate-limited upstream — offer a retry.
  if (error || !jev) {
    const label =
      error === "no-key" ? "offline" : error === "busy" ? "busy" : "unavailable";
    const why =
      error === "no-key"
        ? "Jev is offline: no AI Gateway key configured for this deployment."
        : error === "busy"
          ? "Jev is in high demand right now. Tap to try again."
          : "Jev couldn't be reached right now. Tap to try again.";
    if (error === "busy" && onAsk) {
      return (
        <button
          type="button"
          className="jev-chip jev-offline jev-retry"
          onClick={(e) => {
            e.stopPropagation();
            onAsk();
          }}
          title={why}
        >
          <span className="jev-mark">Jev</span>
          <span className="jev-offline-txt">busy · retry</span>
        </button>
      );
    }
    return (
      <span className="jev-chip jev-offline" title={why}>
        <span className="jev-mark">Jev</span>
        <span className="jev-offline-txt">{label}</span>
      </span>
    );
  }

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
