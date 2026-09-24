"use client";

import { useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/dto";

const W = 640;
const H = 210;
const PAD = { top: 14, right: 8, bottom: 16, left: 8 };
/**
 * Minimum vertical zoom window, in probability points. Thin/illiquid markets
 * can have a real price range of just a few points — without a floor, the
 * chart auto-zooms to fit that tiny range and stretches noise into what
 * looks like a dramatic spike crowding the top edge. Centering a fixed-width
 * window around the data keeps small real moves looking small.
 */
const MIN_SPAN = 0.16;

interface Hover {
  i: number;
  x: number;
  y: number;
}

/**
 * Single-series price area+line chart (change-over-time). Recessive axes, one
 * accent line with a soft gradient fill, current-price dot, and a hover
 * crosshair + tooltip. Pure SVG — no chart lib. (dataviz: one series → no legend.)
 */
export function PriceChart({ points }: { points: HistoryPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const ps = points.map((p) => p.p);
    const rawLo = Math.min(...ps);
    const rawHi = Math.max(...ps);
    const rawSpan = rawHi - rawLo;

    let lo: number;
    let hi: number;
    if (rawSpan >= MIN_SPAN) {
      const pad = rawSpan * 0.15;
      lo = Math.max(0, rawLo - pad);
      hi = Math.min(1, rawHi + pad);
    } else {
      // Real move is smaller than the floor — center a fixed window on it
      // instead of zooming all the way in, then nudge back in bounds if the
      // window would spill past 0 or 1.
      const mid = (rawHi + rawLo) / 2;
      lo = Math.max(0, mid - MIN_SPAN / 2);
      hi = Math.min(1, mid + MIN_SPAN / 2);
      if (hi - lo < MIN_SPAN) {
        if (lo <= 0) hi = Math.min(1, MIN_SPAN);
        else if (hi >= 1) lo = Math.max(0, 1 - MIN_SPAN);
      }
    }
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (i / (points.length - 1)) * iw;
    const y = (p: number) =>
      PAD.top + (1 - (p - lo) / (hi - lo || 1)) * ih;

    const coords = points.map((p, i) => [x(i), y(p.p)] as const);
    const line = coords
      .map(([cx, cy], i) => `${i === 0 ? "M" : "L"}${cx.toFixed(1)},${cy.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD.bottom} L${coords[0][0].toFixed(1)},${H - PAD.bottom} Z`;
    return { coords, line, area, x, y };
  }, [points]);

  if (!geo) {
    return <div className="chart-empty">No price history available.</div>;
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = Math.round(ratio * (points.length - 1));
    const [cx, cy] = geo.coords[i];
    setHover({ i, x: cx, y: cy });
  };

  const last = geo.coords[geo.coords.length - 1];
  const hp = hover ? points[hover.i] : null;

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="chart-svg"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Price history"
      >
        <defs>
          <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={geo.area} fill="url(#pcFill)" />
        <path
          d={geo.line}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--ink-faint)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Endpoint marker as an HTML dot so it stays a true circle — an SVG
          circle would be stretched into an oval by preserveAspectRatio="none". */}
      <span
        className="chart-dot"
        style={{
          left: `${((hover ? hover.x : last[0]) / W) * 100}%`,
          top: `${((hover ? hover.y : last[1]) / H) * 100}%`,
        }}
        aria-hidden
      />

      {hp && (
        <div
          className="chart-tip"
          style={{ left: `${(hover!.x / W) * 100}%` }}
        >
          <span className="chart-tip-p">{(hp.p * 100).toFixed(1)}%</span>
          <span className="chart-tip-t">
            {new Date(hp.t * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
