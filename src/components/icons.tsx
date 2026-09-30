/** Stroke icons shared by the sidebar, phone tabs and palette (currentColor). */
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true } as const;

export const Icon = {
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4L12 3z" fill="currentColor" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 10h16M10 10v10" strokeLinecap="round" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
    </svg>
  ),
  hot: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0 0 13 12c1-1 1-2.5 1-2.5 1.5 1.2 3 3 3 6a5 5 0 1 1-10 0c0-3.6 2.5-5.5 3-8 .3-1.6 1.4-3 2-4.5z" strokeLinejoin="round" />
    </svg>
  ),
  coinflips: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    </svg>
  ),
  ask: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-6l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    </svg>
  ),
  hedge: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M12 4v16M4 8h16M7 8l-3 6a3 3 0 0 0 6 0L7 8zm10 0l-3 6a3 3 0 0 0 6 0l-3-6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  connect: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.1 10.9 15.9 7.1M8.1 13.1 15.9 16.9" strokeLinecap="round" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.6 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.2 2-2.2 3.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  ext: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={1.8}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={1.8}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
