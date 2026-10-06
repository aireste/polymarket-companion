"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FollowLine as Line } from "@/lib/recordMath";

let memo: Promise<{ lines: Line[]; resolved: number } | null> | null = null;
const load = () =>
  (memo ??= fetch("/api/track/summary")
    .then((r) => r.json())
    .then((d) => (d.lines ? d : null))
    .catch(() => null));

const money = (x: number) => `${x < 0 ? "−" : "+"}$${Math.abs(x).toFixed(2)}`;

/**
 * The board's one-line scorecard: "If you'd followed every Wager: 2–0, +$2.33 · every Lean: 5–6,
 * +$0.09 · Track record →". Same numbers as the top of the track record page.
 */
export function FollowLine({ variant }: { variant: "desk" | "phone" }) {
  const [data, setData] = useState<{ lines: Line[]; resolved: number } | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  if (!data || data.resolved === 0) return null;
  return (
    <Link href="/track-record" className={`hp-follow is-${variant}`}>
      <span>If you&apos;d followed every </span>
      {data.lines.map((l, i) => (
        <span key={l.call}>
          {i > 0 && <span className="hp-follow-sep"> · every </span>}
          <b className={l.call === "Wager" ? "is-wager" : "is-hold"}>{l.call}</b>
          {": "}
          {l.won}–{l.lost}
          {l.won + l.lost > 0 && <span className={l.profit >= 0 ? "is-pos" : "is-neg"}>, {money(l.profit)}</span>}
        </span>
      ))}
      <span className="hp-follow-go"> Track record →</span>
    </Link>
  );
}
