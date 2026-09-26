"use client";

import { useCallback, useState } from "react";
import type { JevReadDTO, JevExplainDTO, JevExplainResponse } from "./dto";

interface State {
  explanation: string | null;
  model: string | null;
  loading: boolean;
  /** null = fine; "no-key" = no Anthropic key; string = error message. */
  error: string | null;
  run: () => void;
}

/**
 * On-demand: ask Claude why Jev made its call. Not auto-fired (each is a live
 * Claude request). We pass the read the UI is already showing so the answer
 * matches the chip and Jev isn't re-run.
 */
export function useJevExplain(read: JevReadDTO | null): State {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!read) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jev/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      const data = (await res.json()) as JevExplainResponse;
      if ("error" in data) {
        setError(data.error);
      } else if ("available" in data && data.available === false) {
        setError("no-key");
      } else {
        const ok = data as JevExplainDTO;
        setExplanation(ok.explanation);
        setModel(ok.model);
      }
    } catch {
      setError("Couldn't reach the explainer.");
    } finally {
      setLoading(false);
    }
  }, [read]);

  return { explanation, model, loading, error, run };
}
