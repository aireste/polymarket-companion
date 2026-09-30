"use client";

import { useState } from "react";
import type { PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { selectMarket } from "@/lib/useSelection";
import { pct } from "@/lib/format";

const W = 640;
const H = 280;
const PAD = 34;
const sx = (x: number) => PAD + x * (W - PAD * 2);
const sy = (y: number) => H - PAD - y * (H - PAD * 2);

const FILL = { wager: "var(--accent)", hold: "oklch(0.82 0.14 80)", skip: "var(--paper-2)" } as const;

/** Short label for the focused dot: "NO CHANGE FED". */
const STOP = new Set(
  "there be the will in after by of to win on a an is vs at for and interest rates president next".split(" ")
);
function tag(q: string) {
  return q
    .replace(/^Will /, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
    .slice(0, 3)
    .join(" ")
    .toUpperCase();
}

/**
 * The board as an instrument: every market is a dot at (market price, Jev's
 * probability). The diagonal is "fairly priced"; distance from it is Jev's
 * edge. Dots glide when prices move; dot size is 24h volume.
 */
export function EdgeMap({ plays, focusedId }: { plays: PlayDTO[]; focusedId: string | null }) {
  const { reads, jevStatus } = useBoard();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const read = plays.filter((p) => reads[p.id]);
  const maxV = Math.max(1, ...read.map((p) => p.volume24hr));
  const counts = { wager: 0, hold: 0, skip: 0 };
  read.forEach((p) => counts[reads[p.id].action]++);
  const focused = read.find((p) => p.id === focusedId);
  const hovered = hover && read.find((p) => p.id === hover.id);

  return (
    <section className="hp-map" aria-label="Edge map">
      <div className="hp-map-h">
        <b>Edge map</b>
        <span>
          {jevStatus === "loading" && read.length === 0
            ? "Jev is reading the board…"
            : `${counts.wager} wager · ${counts.hold} hold · ${counts.skip} skip · dot size = 24h volume`}
        </span>
      </div>
      <div className="hp-map-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Market price versus Jev's probability for each market">
          <path d={`M${sx(0)} ${sy(0.02)} L${sx(0.98)} ${sy(1)} L${sx(1)} ${sy(0.98)} L${sx(0.02)} ${sy(0)} Z`} className="hp-map-fair" />
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v} className="hp-map-grid">
              <line x1={sx(v)} y1={sy(0)} x2={sx(v)} y2={sy(1)} />
              <line x1={sx(0)} y1={sy(v)} x2={sx(1)} y2={sy(v)} />
              <text x={sx(v)} y={H - 14} textAnchor="middle">{v * 100}</text>
              <text x={PAD - 8} y={sy(v) + 4} textAnchor="end">{v * 100}</text>
            </g>
          ))}
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="hp-map-diag" />
          <text x={sx(0.05)} y={sy(0.9)} className="hp-map-note pos">↑ Jev sees more than the market</text>
          <text x={sx(0.6)} y={sy(0.08)} className="hp-map-note neg">↓ market priced too high</text>
          <text x={W / 2} y={H - 1} textAnchor="middle" className="hp-map-axis">MARKET PRICE →</text>
          <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`} className="hp-map-axis">JEV →</text>

          {read.map((p) => {
            const j = reads[p.id];
            const r = 5 + Math.sqrt(p.volume24hr / maxV) * 11;
            const cx = sx(p.outcomes[0]?.price ?? 0);
            const cy = sy(j.jevProbability);
            const on = p.id === focusedId;
            return (
              <g
                key={p.id}
                className={`hp-map-pt${on ? " is-on" : ""}`}
                onClick={() => selectMarket(p.id)}
                onMouseEnter={() => setHover({ id: p.id, x: cx, y: cy })}
              >
                {on && <circle className="hp-map-halo" cx={cx} cy={cy} r={r} />}
                <circle cx={cx} cy={cy} r={r} style={{ fill: on ? "var(--ink)" : FILL[j.action] }} />
              </g>
            );
          })}
          {focused && (
            <text
              x={sx(focused.outcomes[0]?.price ?? 0) + 16}
              y={sy(reads[focused.id].jevProbability) - 12}
              className="hp-map-lbl"
            >
              {tag(focused.question)}
            </text>
          )}
        </svg>
        {hovered && hover && (
          <div className="hp-map-tip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>
            {hovered.question.replace(/\?$/, "")} · mkt {pct(hovered.outcomes[0]?.price ?? 0, 0)} · Jev{" "}
            {pct(reads[hovered.id].jevProbability, 0)}
          </div>
        )}
      </div>
      <div className="hp-map-legend">
        <span><i style={{ background: "var(--accent)" }} />wager</span>
        <span><i style={{ background: "oklch(0.82 0.14 80)" }} />hold</span>
        <span><i style={{ background: "var(--paper-2)", border: "1px solid var(--ink-faint)" }} />skip</span>
        <span><i style={{ background: "var(--ink)" }} />selected</span>
      </div>
    </section>
  );
}
