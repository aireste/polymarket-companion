"use client";

import { useEffect, useState } from "react";
import type { HistoryPoint } from "./dto";

/** Fetch a market's price history for a token + range. Lazy, abortable. */
export function usePriceHistory(token: string | undefined, range: string) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    fetch(`/api/history?token=${token}&range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { history?: HistoryPoint[]; error?: string }) => {
        if (!alive) return;
        if (d.error || !d.history || d.history.length < 2) {
          setError(true);
          setHistory(null);
        } else {
          setHistory(d.history);
        }
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, range]);

  return { history, loading, error };
}
