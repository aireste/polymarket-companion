/**
 * Polymarket US price history, shared by the chart route, the board's sparklines, Jev's price-move
 * line, the newsletter and the AI tools.
 *
 * A history key is `<marketSlug>:<side>`: side 0 is the long side (Yes, or the first team), side 1
 * the short side. The API gives display prices for each side (long from the best ask, short from
 * one minus the best bid), so we take their midpoint as the long price, the same way the board
 * prices markets, and the short side as 1 minus that.
 */

import type { HistoryPoint } from "./dto";

const GATEWAY = "https://gateway.polymarket.us";

// range -> Polymarket US window + point spacing (minutes).
export const RANGES: Record<string, { interval: string; fidelity: number }> = {
  "1d": { interval: "INTERVAL_1D", fidelity: 15 },
  "1w": { interval: "INTERVAL_1W", fidelity: 60 },
  "1m": { interval: "INTERVAL_1M", fidelity: 720 },
};

export const isTokenId = (token: string | null | undefined): token is string =>
  !!token && /^[a-z0-9][a-z0-9-]*:[01]$/i.test(token);

/** Fetch one outcome's price series. Throws on network/HTTP failure. */
export async function fetchHistory(token: string, range = "1w", timeoutMs = 10_000): Promise<HistoryPoint[]> {
  const cfg = RANGES[range] ?? RANGES["1w"];
  const [slug, side] = token.split(":");
  const params = new URLSearchParams({ symbol: slug, fixedInterval: cfg.interval, fidelity: String(cfg.fidelity) });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY}/v1/price-history?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Polymarket US history returned HTTP ${res.status}`);
    const data = (await res.json()) as { history?: { timestamp?: unknown; longPrice?: unknown; shortPrice?: unknown }[] };
    return (data.history ?? [])
      .map((d) => {
        const long = Number(d.longPrice);
        const short = Number(d.shortPrice);
        const mid = Number.isFinite(short) ? (long + (1 - short)) / 2 : long;
        return { t: Number(d.timestamp), p: side === "1" ? 1 - mid : mid };
      })
      .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p));
  } finally {
    clearTimeout(timer);
  }
}
