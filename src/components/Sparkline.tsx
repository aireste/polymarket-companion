import type { HistoryPoint } from "@/lib/dto";

/** Tiny 1W trend line for a table row. Same min-span floor idea as PriceChart. */
export function Sparkline({
  points,
  width = 76,
  height = 24,
}: {
  points: HistoryPoint[] | undefined;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) {
    return <svg className="hp-spark" width={width} height={height} aria-hidden />;
  }
  const ps = points.map((p) => p.p);
  const span = Math.max(Math.max(...ps) - Math.min(...ps), 0.06);
  const mid = (Math.max(...ps) + Math.min(...ps)) / 2;
  const lo = mid - span / 2;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t || t0 + 1;
  const xy = points.map((p) => [
    ((p.t - t0) / (t1 - t0 || 1)) * (width - 4) + 2,
    height - 2 - ((p.p - lo) / span) * (height - 4),
  ]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className="hp-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.4" fill="currentColor" />
    </svg>
  );
}
