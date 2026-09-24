"use client";

import type { MobileView } from "./Dashboard";

const icons = {
  markets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 19V5M4 19h16M8 19v-6M12 19v-9M16 19v-4M20 19V8" strokeLinecap="round" strokeLinejoin="round" />
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
};

const TABS: { id: MobileView; label: string; icon: keyof typeof icons }[] = [
  { id: "markets", label: "Markets", icon: "markets" },
  { id: "ask", label: "Ask", icon: "ask" },
  { id: "connect", label: "Your AI", icon: "connect" },
];

/** Mobile-only bottom tab bar. Each tab swaps the visible view (no scrolling). */
export function MobileTabs({
  view,
  setView,
}: {
  view: MobileView;
  setView: (v: MobileView) => void;
}) {
  return (
    <nav className="mobile-tabs" aria-label="Views">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`mtab${view === t.id ? " active" : ""}`}
          onClick={() => setView(t.id)}
          aria-current={view === t.id ? "page" : undefined}
          aria-label={t.label}
        >
          {icons[t.icon]}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
