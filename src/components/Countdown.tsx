"use client";

import type { PlayDTO } from "@/lib/dto";
import { useNow } from "@/lib/boardStore";
import { countdown } from "@/lib/format";

/** A countdown that ticks every second ("in 1h 05m 48s"). */
export function Countdown({ play, seconds = true, bare = false }: { play: PlayDTO; seconds?: boolean; bare?: boolean }) {
  const now = useNow(1000);
  const text = countdown(play, now, seconds);
  return <>{bare ? text.replace(/^in /, "") : text}</>;
}
