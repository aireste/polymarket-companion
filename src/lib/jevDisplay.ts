/**
 * Shared display helpers for Jev's read, so the pill, the inspector, the phone
 * pass and the chat all use the same words for the same call.
 */
import type { JevReadDTO } from "./dto";

export type JevAction = JevReadDTO["action"];

/** "hold" is shown as "Lean": Jev leans one way, but not enough to call a wager. */
export const JEV_ACTION_COPY: Record<JevAction, { label: string; blurb: string; cls: string }> = {
  wager: { label: "Wager", blurb: "Jev picks a side outright.", cls: "wager" },
  hold: { label: "Lean", blurb: "Jev leans one way, not strongly.", cls: "hold" },
  skip: { label: "Skip", blurb: "Both prices look fair.", cls: "skip" },
};

/** Bucket Jev's calibrated confidence [0,1] into a plain label. */
export function confidenceLabel(confidence: number | null): string | null {
  if (confidence == null) return null;
  if (confidence >= 0.66) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

/** Short side name for tight spaces ("Philadelphia Phillies" -> "Philadelphia Phi…"). */
export function shortSide(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** The side Jev leans toward, or null. */
export function leanSide(read: Pick<JevReadDTO, "sides" | "lean">) {
  return read.lean == null ? null : read.sides[read.lean] ?? null;
}
