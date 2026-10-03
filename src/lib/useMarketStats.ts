"use client";

import { useEffect, useState } from "react";
import type { PlayDTO } from "./dto";

/**
 * Lifetime volume and liquidity for one market. The board doesn't carry them (Polymarket US only
 * gives them per market, a few lookups a minute), so the detail view asks for them when it opens.
 * Null until loaded, and stays null if the lookup is refused.
 */
export function useMarketStats(play: PlayDTO) {
  const [stats, setStats] = useState<{ id: string; volume: number | null; liquidity: number | null } | null>(null);
  const known = play.volume != null;
  useEffect(() => {
    if (known) return;
    let live = true;
    fetch(`/api/market?id=${encodeURIComponent(play.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { play?: PlayDTO } | null) => {
        if (live && d?.play) setStats({ id: play.id, volume: d.play.volume, liquidity: d.play.liquidity });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [play.id, known]);
  const s = stats?.id === play.id ? stats : null;
  return { volume: play.volume ?? s?.volume ?? null, liquidity: play.liquidity ?? s?.liquidity ?? null };
}
