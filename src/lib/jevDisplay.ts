/**
 * Shared display helpers for Jev's calibrated read, used by the chip and the
 * expanded card so the label + colour scheme stay in one place.
 */
import type { JevReadDTO } from "./dto";

export type JevAction = JevReadDTO["action"];

export const JEV_ACTION_COPY: Record<
  JevAction,
  { label: string; blurb: string; cls: string }
> = {
  wager: {
    label: "Wager",
    blurb: "Calibrated edge worth acting on.",
    cls: "wager",
  },
  hold: {
    label: "Hold",
    blurb: "Thin edge; wait for a better line.",
    cls: "hold",
  },
  skip: {
    label: "Skip",
    blurb: "Priced efficiently, no edge.",
    cls: "skip",
  },
};

/** Bucket Jev's calibrated confidence [0,1] into a plain label. */
export function confidenceLabel(confidence: number | null): string | null {
  if (confidence == null) return null;
  if (confidence >= 0.66) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

const VALUATION_COPY: Record<JevReadDTO["valuation"], string> = {
  undervalued: "undervalued",
  fair: "fairly priced",
  overvalued: "overvalued",
};

export function valuationLabel(v: JevReadDTO["valuation"]): string {
  return VALUATION_COPY[v];
}

/** Signed edge in probability points, e.g. "+4.2 pts" / "-1.0 pts". */
export function edgeLabel(edge: number): string {
  const pts = edge * 100;
  const sign = pts >= 0 ? "+" : "";
  return `${sign}${pts.toFixed(1)} pts`;
}
