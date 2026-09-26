"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JevReadDTO, JevResponse } from "./dto";

interface State {
  jev: JevReadDTO | null;
  loading: boolean;
  /** null = fine; "no-key" = gateway key missing; string = error message. */
  error: string | null;
  /** Manual re-run (also used to retry after an error). */
  run: () => void;
}

/**
 * Jev's calibrated read for one market. Unlike useRecommendation (a slow, paid
 * Claude + web-search call, fired on demand), Jev is a fast calibrated decision
 * call, so we AUTO-FIRE once on mount to populate the glanceable chip. Set
 * `auto: false` to require an explicit run().
 */
export function useJev(
  marketId: string,
  { auto = true }: { auto?: boolean } = {}
): State {
  const [jev, setJev] = useState<JevReadDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard against double-fire in React strict mode / rapid re-renders.
  const started = useRef(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: marketId }),
      });
      const data = (await res.json()) as JevResponse;
      if ("error" in data) {
        setError(data.error);
      } else if ("available" in data && data.available === false) {
        setError("no-key");
      } else {
        setJev(data as JevReadDTO);
      }
    } catch {
      setError("Couldn't reach Jev.");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    run();
  }, [auto, run]);

  return { jev, loading, error, run };
}
