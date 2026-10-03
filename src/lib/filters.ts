/**
 * Board categories. Each one is a real route backed by Polymarket US categories,
 * so the tabs, the phone chips and shared links all agree.
 * "All" is the main ranked board the Daily and the track record use.
 */
import type { PlayDTO } from "./dto";
import { isLive, whenMs } from "./format";

export type CategoryId = "all" | "sports" | "politics" | "crypto" | "finance" | "tech" | "culture" | "world";

export const CATEGORIES: { id: CategoryId; href: string; label: string; us: string[] | null }[] = [
  { id: "all", href: "/", label: "All", us: null },
  { id: "sports", href: "/sports", label: "Sports", us: ["sports"] },
  { id: "politics", href: "/politics", label: "Politics", us: ["politics"] },
  { id: "crypto", href: "/crypto", label: "Crypto", us: ["crypto"] },
  { id: "finance", href: "/finance", label: "Finance", us: ["finance", "macro"] },
  { id: "tech", href: "/tech", label: "Tech", us: ["technology"] },
  { id: "culture", href: "/culture", label: "Culture", us: ["culture"] },
  { id: "world", href: "/world", label: "World", us: ["geopolitics", "climate", "science"] },
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
