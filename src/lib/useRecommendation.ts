"use client";

import { useCallback, useState } from "react";
import type { RecommendationDTO, RecommendationResponse } from "./dto";

interface State {
  rec: RecommendationDTO | null;
  loading: boolean;
  /** null = fine; string = error message; "no-key" = needs an API key. */
  error: string | null;
  run: () => void;
}

/**
 * On-demand recommendation fetch. Not auto-fired: each call is a live Claude +
 * web-search request (~15-30s, small cost), so the user triggers it per market.
 */
export function useRecommendation(marketId: string): State {
  const [rec, setRec] = useState<RecommendationDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: marketId }),
      });
      const data = (await res.json()) as RecommendationResponse;
      if ("error" in data) {
        setError(data.error);
      } else if ("available" in data && data.available === false) {
        setError("no-key");
      } else {
        setRec(data as RecommendationDTO);
      }
    } catch {
      setError("Couldn't reach the recommendation service.");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  return { rec, loading, error, run };
}
