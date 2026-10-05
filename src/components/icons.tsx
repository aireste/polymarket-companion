/** Stroke icons shared by the sidebar, phone tabs and palette (currentColor). */
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true } as const;

export const Icon = {
  /**
   * The HedgePredict mark, "Split": the three-part bar from every call card (bargain, fair,
   * bargain) stacked three times, with the two sides trading places top to bottom. Both sides of
   * a market, balanced. The short segments are a lighter tone of whatever color the mark is set in.
   */
  logo: (
    <svg viewBox="0 0 48 48" aria-hidden>
      {/* The classes let the top bar slide the two rows' blocks past each other (see desk.css). */}
      <rect className="lg-a" x="7" y="7" width="21" height="9" fill="currentColor" />
      <rect className="lg-b" x="31.5" y="7" width="9.5" height="9" fill="currentColor" opacity="0.5" />
      <rect x="7" y="19.5" width="34" height="9" fill="currentColor" />
      <rect className="lg-c" x="7" y="32" width="9.5" height="9" fill="currentColor" opacity="0.5" />
      <rect className="lg-d" x="20" y="32" width="21" height="9" fill="currentColor" />
    </svg>
  ),
  /** The four-point spark, the old logo. Kept for anything that still wants a plain sparkle. */
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
  /** Hedge Lab: a flask with the HedgePredict mark (the split bars) inside. */
  hedge: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M9.5 3h5M10 3v6.2L5.2 17.6A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.4L14 9.2V3" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="currentColor" stroke="none">
        <rect x="9" y="12.6" width="3.7" height="1.7" />
        <rect x="13.5" y="12.6" width="1.5" height="1.7" opacity="0.5" />
        <rect x="9" y="15.1" width="6" height="1.7" />
        <rect x="9" y="17.6" width="1.5" height="1.7" opacity="0.5" />
        <rect x="11.3" y="17.6" width="3.7" height="1.7" />
      </g>
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
  /** A coffee cup with steam, for the tip jar. */
  coffee: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M5 10h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5V10z" strokeLinejoin="round" />
      <path d="M16 11.5h1.2a2.3 2.3 0 0 1 0 4.6H15.6M8 4v2.5M11.5 4v2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
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
  /** Polymarket's own mark (from polymarket.com/icons/safari-pinned-tab.svg), recolorable. */
  polymarket: (
    <svg viewBox="0 0 2184 2184" aria-hidden>
      <g transform="translate(0 2184) scale(0.1 -0.1)" fill="currentColor">
        <path d="M10445 15709 c-2667 -764 -4860 -1391 -4872 -1394 l-23 -5 0 -3345 0 -3344 23 -7 c79 -25 9722 -2782 9724 -2780 2 1 2 2761 1 6133 l-3 6129 -4850 -1387z m3915 -1910 c0 -1939 -1 -2041 -17 -2037 -160 43 -7100 2032 -7105 2037 -7 6 7068 2037 7105 2040 16 1 17 -102 17 -2040z m-4263 -1806 c1976 -565 3591 -1028 3590 -1029 -4 -4 -7141 -2045 -7169 -2051 l-28 -5 0 2056 c0 1131 3 2056 8 2056 4 0 1623 -462 3599 -1027z m4263 -3864 l0 -2041 -27 5 c-16 3 -1617 460 -3560 1016 -1942 556 -3535 1011 -3539 1011 -4 0 -4 3 0 7 5 6 7095 2040 7119 2042 4 1 7 -918 7 -2040z" />
      </g>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={1.8}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
