"use client";

import type { FilterId } from "./Dashboard";

/** Minimal stroke icons (currentColor). */
const icons = {
  spark: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4L12 3z"
        fill="currentColor"
      />
    </svg>
  ),
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
    </svg>
  ),
  hot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0 0 13 12c1-1 1-2.5 1-2.5 1.5 1.2 3 3 3 6a5 5 0 1 1-10 0c0-3.6 2.5-5.5 3-8 .3-1.6 1.4-3 2-4.5z" strokeLinejoin="round" />
    </svg>
  ),
  coinflip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 4v16M6 8l6-4 6 4M5 11h4l-2 5a3 3 0 0 1-2-5zm10 0h4l-2 5a3 3 0 0 1-2-5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  soon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ask: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-6l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    </svg>
  ),
  connect: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.1 10.9 15.9 7.1M8.1 13.1 15.9 16.9" strokeLinecap="round" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.6 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.2 2-2.2 3.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  ext: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const NAV: { id: FilterId; label: string; icon: keyof typeof icons }[] = [
  { id: "all", label: "Today", icon: "today" },
  { id: "live", label: "Live", icon: "live" },
  { id: "hot", label: "Hot", icon: "hot" },
  { id: "coinflip", label: "Coin-flips", icon: "coinflip" },
  { id: "soon", label: "Soon", icon: "soon" },
];

export function Rail({
  filter,
  onFilter,
  onAsk,
  onConnect,
  onHelp,
}: {
  filter: FilterId;
  /** Set the filter and scroll the market list into view. */
  onFilter: (f: FilterId) => void;
  onAsk: () => void;
  onConnect: () => void;
  onHelp: () => void;
}) {
  return (
    <nav className="rail" aria-label="Sections">
      <span className="rail-brand" aria-hidden>
        {icons.spark}
      </span>
      <button className="rail-btn" onClick={onAsk} aria-label="Ask HedgePredict">
        {icons.ask}
        <span className="rail-label">Ask</span>
      </button>
      {NAV.map((n) => (
        <button
          key={n.id}
          className={`rail-btn${filter === n.id ? " active" : ""}`}
          onClick={() => onFilter(n.id)}
          aria-label={n.label}
          aria-current={filter === n.id ? "page" : undefined}
        >
          {icons[n.icon]}
          <span className="rail-label">{n.label}</span>
        </button>
      ))}
      <span className="rail-spacer" />
      <button
        className="rail-btn rail-ext"
        onClick={onConnect}
        aria-label="Use in your own AI"
      >
        {icons.connect}
        <span className="rail-label">Use in your AI</span>
      </button>
      <button
        className="rail-btn rail-ext"
        onClick={onHelp}
        aria-label="How it works"
      >
        {icons.help}
        <span className="rail-label">How it works</span>
      </button>
      <a
        className="rail-btn rail-ext"
        href="https://polymarket.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Polymarket"
      >
        {icons.ext}
        <span className="rail-label">Polymarket</span>
      </a>
    </nav>
  );
}
