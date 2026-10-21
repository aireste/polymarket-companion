/** The decision for one market, with no database in it so it can be tested alone. See callStability.ts for why. */
import type { JevReadDTO } from "./dto";

export const HOLD_MS = 30 * 60 * 1000;

export type Key = { action: string; side: string | null };
export type Pending = Key & { since: number };
export type CallState = Key & { price: number | null; howSure: number };

const same = (a: Key | undefined | null, b: Key) => !!a && a.action === b.action && (a.side ?? null) === (b.side ?? null);

/** The raw read, showing the confirmed call instead of the one that hasn't held yet. Prices stay live. */
export function showConfirmed(raw: JevReadDTO, c: Key): JevReadDTO {
  if (c.action === "skip" || c.action === "decided") {
    return { ...raw, action: "skip", lean: null, strength: raw.distribution.neither };
  }
  const lean = raw.sides.findIndex((s) => s.label === c.side);
  if (lean < 0 || (c.action !== "wager" && c.action !== "hold")) return raw;
  return { ...raw, action: c.action, lean, strength: raw.distribution.sides[lean] ?? raw.strength };
}

export type Step = { show: "raw" | "confirmed"; log?: boolean; pend?: boolean; clear?: boolean };

/** s = what this read says, c = the market's confirmed call (undefined if none yet), p = a challenger already waiting. */
export function step(s: CallState, c: Key | undefined, p: Pending | undefined, now: number): Step {
  if (same(c, s)) return { show: "raw", clear: !!p }; // back to the confirmed call: the challenger gave up
  // Nothing confirmed yet: a market's first row only counts if it's an actual call, and it still has to hold.
  if (!c && (s.action === "skip" || s.action === "decided")) return { show: "raw", clear: !!p }; // a first call that flickered away starts over
  const held = !!p && same(p, s) && now - p.since >= HOLD_MS;
  if (s.action === "decided" || held) return { show: "raw", log: true, clear: !!p };
  return { show: c ? "confirmed" : "raw", pend: !p || !same(p, s) };
}
