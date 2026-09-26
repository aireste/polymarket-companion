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
 * Jev's calibrated read for one market. On-demand by default: the user taps
 * "Ask Jev" to fire it, so opening the app doesn't hammer the AI Gateway with a
 * call per market (and each read stays a deliberate action). Pass `auto: true`
 * to fire once on mount instead.
 */
export function useJev(
  marketId: string,
  { auto = false }: { auto?: boolean } = {}
): State {
  const [jev, setJev] = useState<JevReadDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard against double-fire in React strict mode / rapid re-renders.
  const started = useRef(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    // The Jev model on the AI Gateway intermittently 429s under upstream load.
    // Ride out short spikes with a couple of backoff retries before surfacing an
    // error, so a transient burst self-heals without the user re-tapping.
    const isRateLimited = (msg: string) =>
      /rate.?limit|high demand|429|overloaded/i.test(msg);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const backoffs = [2500, 5000];

    try {
      for (let attempt = 0; ; attempt++) {
        let data: JevResponse;
        try {
          const res = await fetch("/api/jev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: marketId }),
          });
          data = (await res.json()) as JevResponse;
        } catch {
          setError("Couldn't reach Jev.");
          return;
        }

        if ("available" in data && data.available === false) {
          setError("no-key");
          return;
        }
        if (!("error" in data)) {
          setJev(data as JevReadDTO);
          return;
        }
        // Retry on a transient rate-limit; otherwise surface the error.
        if (isRateLimited(data.error) && attempt < backoffs.length) {
          setError("busy");
          await wait(backoffs[attempt]);
          continue;
        }
        setError(isRateLimited(data.error) ? "busy" : data.error);
        return;
      }
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
