import type { Signals } from "@/lib/scoring";

/**
 * One compact glyph, four facets: momentum · liquidity · uncertainty ·
 * timeliness. Each bar fills proportionally to its signal (0..1), so the
 * whole thing reads at a glance without four separate gauges.
 */
export function SignalMeter({ signals }: { signals: Signals }) {
  const facets: [string, number][] = [
    ["Momentum", signals.momentum],
    ["Liquidity", signals.liquidity],
    ["Uncertainty", signals.uncertainty],
    ["Timeliness", signals.timeliness],
  ];
  const title = facets
    .map(([k, v]) => `${k} ${Math.round(v * 100)}`)
    .join(" · ");

  return (
    <span
      className="meter"
      title={title}
      role="img"
      aria-label={`Signal — ${title}`}
    >
      {facets.map(([k, v]) => (
        <i
          key={k}
          style={{
            background: `color-mix(in oklch, var(--ink) ${Math.round(
              Math.max(0.1, v) * 100
            )}%, var(--rule))`,
          }}
        />
      ))}
    </span>
  );
}
