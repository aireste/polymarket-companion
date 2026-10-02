/**
 * Board categories. Each one is a real route backed by a Polymarket category
 * (Gamma tag id), so the tabs, the phone chips and shared links all agree.
 * "All" is the main ranked board the Daily and the track record use.
 */
import type { PlayDTO } from "./dto";
import { isLive, whenMs } from "./format";

export type CategoryId = "all" | "sports" | "politics" | "crypto" | "finance" | "tech" | "culture" | "world";

export const CATEGORIES: { id: CategoryId; href: string; label: string; tagId: number | null }[] = [
  { id: "all", href: "/", label: "All", tagId: null },
  { id: "sports", href: "/sports", label: "Sports", tagId: 1 },
  { id: "politics", href: "/politics", label: "Politics", tagId: 2 },
  { id: "crypto", href: "/crypto", label: "Crypto", tagId: 21 },
  { id: "finance", href: "/finance", label: "Finance", tagId: 120 },
  { id: "tech", href: "/tech", label: "Tech", tagId: 1401 },
  { id: "culture", href: "/culture", label: "Culture", tagId: 596 },
  { id: "world", href: "/world", label: "World", tagId: 100265 },
];

export const categoryById = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

/** "Today's pick" on the main board (it matches the Daily); "Sports pick" etc. on a category board. */
export const pickLabel = (id: CategoryId) => (id === "all" ? "Today's pick" : `${categoryById(id).label} pick`);

/** Parse a ?c= value; anything unknown is the main board. */
export function toCategory(v: string | null | undefined): CategoryId {
  return CATEGORIES.some((c) => c.id === v) ? (v as CategoryId) : "all";
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
