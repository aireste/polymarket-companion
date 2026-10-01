/** Small display formatters, shared by the UI. */

/** Compact USD, e.g. 383412 -> "$383k", 1250000 -> "$1.3M". */
export function usd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Probability in [0,1] -> "49.5%". */
export function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/**
 * All times show in US Eastern, like Polymarket itself, so the board, the
 * clock and Polymarket's own pages always agree.
 */
export const MARKET_TZ = "America/New_York";

/** Resolution date + time in ET, e.g. "Sep 29, 1:05 PM ET" (+ year if not this year). */
export function resolveAt(iso: string | null): string {
  if (!iso) return "no close date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return (
    d.toLocaleString("en-US", {
      timeZone: MARKET_TZ,
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "numeric",
      minute: "2-digit",
    }) + " ET"
  );
}

/** Wall clock in ET, e.g. "10:26:17 PM". */
export function clockET(now = Date.now()): string {
  return new Date(now).toLocaleTimeString("en-US", {
    timeZone: MARKET_TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * How long after game start we still call a match LIVE. The Gamma payload gives
 * us the start time but NOT the end time, so this is a deliberate heuristic cap
 * (covers a long game) rather than a precise "in progress" signal.
 */
export const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** A scheduled game is live if it has started and we're within the live window. */
export function isLive(gameStartTime: string | null, now = Date.now()): boolean {
  if (!gameStartTime) return false;
  const start = new Date(gameStartTime).getTime();
  if (Number.isNaN(start)) return false;
  return now >= start && now - start < LIVE_WINDOW_MS;
}

/**
 * The right timing label for a market. Scheduled games show "LIVE" or their
 * real start time ("starts Sep 24, 9:10 PM"); everything else shows its
 * resolution date. Avoids the old bug where a game tonight read "resolves Oct 1".
 */
export function timingLabel(
  gameStartTime: string | null,
  endDate: string | null,
  now = Date.now()
): string {
  if (gameStartTime) {
    const start = new Date(gameStartTime).getTime();
    if (!Number.isNaN(start)) {
      if (isLive(gameStartTime, now)) return "LIVE";
      if (start >= now) return `starts ${resolveAt(gameStartTime)}`;
    }
  }
  return `resolves ${resolveAt(endDate)}`;
}

/** Days-to-resolution label from an ISO date, e.g. "3d", "5w", "resolved?". */
export function horizon(iso: string | null): string {
  if (!iso) return "open-ended";
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "resolving";
  if (days < 1) return "<1d";
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 90) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/** Real-moment timestamp for a market: game start for sports, else close date. */
export function whenMs(p: { gameStartTime: string | null; endDate: string | null }): number {
  const iso = p.gameStartTime ?? p.endDate;
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Flighty-style countdown: "LIVE", "in 43m", "in 6h 12m", "in 29 days". */
export function countdown(
  p: { gameStartTime: string | null; endDate: string | null },
  now = Date.now(),
  seconds = false
): string {
  if (isLive(p.gameStartTime, now)) return "LIVE";
  const ms = whenMs(p) - now;
  if (!Number.isFinite(ms)) return "open-ended";
  if (ms < 0) return "awaiting result";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  if (h >= 48) {
    const d = Math.round(h / 24);
    return `in ${d} days`;
  }
  if (h >= 1) return `in ${h}h ${String(m).padStart(2, "0")}m${seconds ? ` ${ss}s` : ""}`;
  return `in ${m}m${seconds ? ` ${ss}s` : ""}`;
}

/** Clock face for the board: "9:30 PM" within a day, else "Oct 28". */
export function clockLabel(
  p: { gameStartTime: string | null; endDate: string | null },
  now = Date.now()
): string {
  const t = whenMs(p);
  if (!Number.isFinite(t)) return "Open";
  const d = new Date(t);
  const h = (t - now) / 3_600_000;
  return h < 24
    ? d.toLocaleTimeString("en-US", { timeZone: MARKET_TZ, hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { timeZone: MARKET_TZ, month: "short", day: "numeric" });
}

/**
 * A share price in cents ("44¢"). Used wherever a market price sits next to
 * Jev's confidence percentages, so the two can't be read as the same thing.
 */
export function cents(p: number): string {
  const c = Math.round(p * 100);
  if (c < 1) return "<1¢";
  if (c > 99) return ">99¢";
  return `${c}¢`;
}

/** How prices display: Polymarket's own cents/percent, or US sportsbook odds. */
export type OddsFormat = "poly" | "us";

/**
 * A price in [0,1] as American odds. A Polymarket price is an implied
 * probability, so 62¢ -> -163 (bet $163 to win $100) and 40¢ -> +150
 * (bet $100 to win $150). Clamped to 1-99¢ like `cents`.
 */
export function american(p: number): string {
  const q = Math.min(0.99, Math.max(0.01, p));
  if (Math.abs(q - 0.5) < 0.005) return "+100";
  const v = Math.round(q > 0.5 ? (-q / (1 - q)) * 100 : ((1 - q) / q) * 100);
  return v > 0 ? `+${v}` : `${v}`;
}

/**
 * A market price in the viewer's chosen format. In "poly" mode it renders
 * exactly as before (`as` picks cents or percent for that spot). Only prices
 * go through here: Jev's confidence numbers are not odds and stay as %.
 */
export function price(p: number, fmt: OddsFormat, as: "cents" | "pct" = "cents", digits = 1): string {
  if (fmt === "us") return american(p);
  return as === "pct" ? pct(p, digits) : cents(p);
}
