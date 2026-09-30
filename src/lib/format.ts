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
 * Actual resolution date + time in the viewer's local timezone.
 * e.g. "Sep 29, 1:05 PM" (this year) or "Jan 3, 2027, 2:00 AM" (other year).
 */
export function resolveAt(iso: string | null): string {
  if (!iso) return "no close date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
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
  now = Date.now()
): string {
  if (isLive(p.gameStartTime, now)) return "LIVE";
  const ms = whenMs(p) - now;
  if (!Number.isFinite(ms)) return "open-ended";
  if (ms < 0) return "awaiting result";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `in ${h}h ${Math.round((ms % 3_600_000) / 60_000)}m`;
  const d = Math.round(ms / 86_400_000);
  return `in ${d} ${d === 1 ? "day" : "days"}`;
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
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
