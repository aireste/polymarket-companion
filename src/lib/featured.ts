/**
 * Event days: a featured section at the top of the board for one big slate (College Football
 * Saturday, the Super Bowl, election night). Each is one entry here: its name, the window it runs
 * (start and end in UTC, so daylight saving can't shift it), which boards show it, and which
 * Polymarket US events count (by event-slug prefix). It switches itself on and off by the clock.
 * Kept dependency-free so the client can import it.
 */
import type { CategoryId } from "./filters";

export interface Feature {
  id: string;
  label: string;
  /** When it shows, as UTC instants: midnight to midnight Eastern for a one-day event. */
  from: string;
  to: string;
  /** Polymarket US event slugs that belong, e.g. "cfb-" for college football games. */
  eventPrefix: string;
  /** Most games pulled in by volume (each gets a HedgePredict call, so this caps the extra TypeSafe use). */
  limit: number;
  /** Games that always show, whatever their volume: any matchup whose title contains one of these. */
  pin?: string[];
  boards: CategoryId[];
}

export const FEATURES: Feature[] = [
  {
    id: "cfb-2026-10-03",
    label: "College Football Saturday",
    from: "2026-10-03T04:00:00Z", // Sat Oct 3, midnight ET
    to: "2026-10-04T04:00:00Z",
    eventPrefix: "cfb-",
    limit: 12,
    pin: ["Auburn vs. Tennessee", "Vanderbilt"], // the home teams for a Nashville Saturday
    boards: ["all", "sports"],
  },
];

/** The event running on this board right now, if any. */
export function activeFeature(category: CategoryId, now = Date.now()): Feature | null {
  return FEATURES.find((f) => f.boards.includes(category) && now >= Date.parse(f.from) && now < Date.parse(f.to)) ?? null;
}

/** Whether a board market belongs to the event: its event matches and its game is in the window. */
export function inFeature(f: Feature, p: { id: string; gameStartTime: string | Date | null }): boolean {
  if (!p.id.startsWith(f.eventPrefix) || !p.gameStartTime) return false;
  const t = new Date(p.gameStartTime).getTime();
  return t >= Date.parse(f.from) && t < Date.parse(f.to);
}
