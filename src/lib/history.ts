/**
 * Polymarket CLOB price history, shared by the per-market chart route and the
 * board's sparklines.
 */

import type { HistoryPoint } from "./dto";

const CLOB = "https://clob.polymarket.com/prices-history";

// range -> Polymarket interval + point fidelity (minutes).
export const RANGES: Record<string, { interval: string; fidelity: number }> = {
  "1d": { interval: "1d", fidelity: 15 },
  "1w": { interval: "1w", fidelity: 180 },
  "1m": { interval: "1m", fidelity: 720 },
};

export const isTokenId = (token: string | null | undefined): token is string =>
  !!token && /^\d+$/.test(token);

/** Fetch one outcome token's price series. Throws on network/HTTP failure. */
export async function fetchHistory(
  token: string,
  range = "1w",
  timeoutMs = 10_000
): Promise<HistoryPoint[]> {
  const cfg = RANGES[range] ?? RANGES["1w"];
  const params = new URLSearchParams({
    market: token,
    interval: cfg.interval,
    fidelity: String(cfg.fidelity),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${CLOB}?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`CLOB returned HTTP ${res.status}`);
    const data: unknown = await res.json();
    const raw = (data as { history?: unknown }).history;
    return Array.isArray(raw)
      ? raw
          .map((d) => {
            const pt = d as { t?: unknown; p?: unknown };
            return { t: Number(pt.t), p: Number(pt.p) };
          })
          .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p))
      : [];
  } finally {
    clearTimeout(timer);
  }
}
