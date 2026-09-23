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
