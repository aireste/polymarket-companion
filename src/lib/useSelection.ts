"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/** The market in focus lives in the URL (?m=<id>), so any view is a shareable link. */
export function useSelectedId(): string | null {
  return useSearchParams().get("m");
}

/**
 * Focus a market without a navigation. Desktop swaps the inspector in place
 * ("replace", no history spam); the phone sheet uses "push" so the back
 * button/gesture closes it. Next syncs useSearchParams with native history.
 */
export function selectMarket(id: string | null, mode: "replace" | "push" = "replace") {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("m", id);
  else url.searchParams.delete("m");
  const next = url.pathname + url.search;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/** Desktop command center vs phone board. null until measured (first paint). */
export function useIsDesktop(): boolean | null {
  const [desk, setDesk] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setDesk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desk;
}
