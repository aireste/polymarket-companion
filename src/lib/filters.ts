/**
 * Board filters. Each one is a real route, so the sidebar, the phone chips and
 * shared links all agree on what "Live" or "Coin-flips" means.
 */
import type { PlayDTO } from "./dto";
import { isLive, whenMs } from "./format";

export type FilterId = "all" | "live" | "hot" | "coinflips";

export const FILTERS: {
  id: FilterId;
  href: string;
  label: string;
  title: string;
  caption: string;
}[] = [
  { id: "all", href: "/", label: "Today", title: "Today", caption: "Ranked by signal: momentum, liquidity, uncertainty, timing" },
  { id: "live", href: "/live", label: "Live", title: "Live now", caption: "Games in progress right now" },
  { id: "hot", href: "/hot", label: "Hot", title: "Hot", caption: "Most traded in the last 24 hours" },
  { id: "coinflips", href: "/coinflips", label: "Coin-flips", title: "Coin-flips", caption: "No strong favorite, where a read matters most" },
];

export const filterById = (id: FilterId) => FILTERS.find((f) => f.id === id)!;

/** A genuine coin-flip: no outcome is a strong favorite (top price <= 60%). */
export function isCoinflip(p: PlayDTO): boolean {
  if (p.outcomes.length === 0) return false;
  return Math.max(...p.outcomes.map((o) => o.price)) <= 0.6;
}

export function applyFilter(plays: PlayDTO[], f: FilterId, now = Date.now()): PlayDTO[] {
  switch (f) {
    case "live":
      return plays.filter((p) => isLive(p.gameStartTime, now)).sort((a, b) => whenMs(a) - whenMs(b));
    case "hot":
      return [...plays].sort((a, b) => b.volume24hr - a.volume24hr);
    case "coinflips":
      return plays.filter(isCoinflip).sort((a, b) => b.volume24hr - a.volume24hr);
    default:
      return plays;
  }
}

export function filterCount(plays: PlayDTO[], f: FilterId, now = Date.now()): number | null {
  if (f === "hot") return null; // a re-sort, not a subset
  return applyFilter(plays, f, now).length;
}

/** Phone board groups, Flighty-style: by when the market resolves. */
export const TIME_GROUPS = [
  { id: "live", label: "Live now" },
  { id: "day", label: "Next 24 hours" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
] as const;

export function timeGroup(p: PlayDTO, now = Date.now()): (typeof TIME_GROUPS)[number]["id"] {
  if (isLive(p.gameStartTime, now)) return "live";
  const h = (whenMs(p) - now) / 3_600_000;
  if (h < 24) return "day";
  if (h < 168) return "week";
  return "later";
}
