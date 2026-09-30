# HedgePredict — Design System

Direction (COMMITTED, 2026-09-22): **Clean Light Dashboard.** Light canvas, dark
left icon rail, clean white cards + one lime accent, big bold numbers. The
featured market chart is a **dark rounded "centerpiece" card** (like a fintech
portfolio-performance card sitting inside a light dashboard). References: a
fintech dashboard (dark hero card among light cards) + the lime team-workflow
dashboard. "OS-clean" info tool — it is NOT a betting UI; users read the best
play here, then go to Polymarket to trade. No more wholesale theme flips —
refine within this direction only.

(Superseded directions, for reference only: dark Flighty; soft light dashboard;
dark app; light editorial.)

## Layout (2026-09-29): Desk on desktop, Departures on phone
Chosen from two clickable renditions (Esteban picked A's desktop + B's phone).
- **Real routes, no scroll-to-section.** `/` Today, `/live`, `/hot`, `/coinflips`
  (board filters), `/ask`, `/hedge`, `/connect`, `/how-it-works`. The focused
  market is `?m=<id>` (shareable; phone back gesture closes the sheet).
- **Desktop "Desk" (>= 900px):** dark labeled sidebar (216px; icon-only 72px
  between 900 and 1180px) + top bar (breadcrumb, ⌘K search of all Polymarket,
  updated-ago + refresh). Board = dense table (rank, market + countdown + 24h vol,
  price, 1W sparkline, Jev pill) + right **inspector** (dark price card, Jev
  verdict with wager/hold/skip bars, optional Claude deep read, stats). Arrow keys
  / j k walk the table.
- **Phone "Departures" (< 900px):** date + "What's resolving" title, search bar,
  filter chips, Jev summary line, then time groups (Live now / Next 24 hours /
  This week / Later) of Flighty cards (big clock, Jev pill, Yes/No split bar,
  countdown). Tap = bottom sheet (90dvh) with the same inspector; board scales
  back behind it. Floating bottom tab bar: Board / Ask / Hedge / Your AI.
- Jev reads for the whole board come from `/api/jev/board` (10-min server cache),
  so every row shows a verdict without per-visitor calls.
- **Dark mode (2026-09-30):** a token remap, not a new direction. Follows the OS
  by default; the sun/moon toggle (top bar; phone board header) pins it via
  `html[data-theme]` + localStorage `hp_theme`, applied before paint by an inline
  script. In dark, `--dark` surfaces (sidebar, price card, phone widgets) sit a
  step darker than the canvas with a hairline border. Primary pills invert
  (light pill on dark).
- **Motion rule:** every animation reflects a real change (price tick, Jev
  re-read, countdown, navigation). Sliding sidebar highlight + filter thumb,
  route fade-rise, odometer prices, breathing chart "now" dot. No ticker tape
  (Esteban found it noisy); no edge-map scatter (hard to read).
- **Ask** is a dropdown chat under the top-bar button (stays mounted, keeps the
  conversation); `/ask` remains for phone and long chats.
- **Hedge Lab** (`/hedge`): inputs card + dark readout instrument with outcome
  bars and a hedge-size slider marked at "Full lock".
- Styles for all of this live in `src/app/app.css` (`hp-` prefix). Beware
  Tailwind v4 utility names as bare class names (`collapse` = visibility:collapse
  bit us; renamed to `acc`).

---

## LEGACY NOTES (older direction — Dark Flighty)
Direction: **Dark, Flighty-inspired** (warm dark canvas + glow depth, gradient
"collectible" stat cards, lime accent, floating pill nav, big friendly numbers).
Same token names as the earlier light system, remapped to dark in globals.css.
KPI cards use gradient variants `.grad-a` (indigo), `.grad-b` (teal), `.grad-c`
(lime). Primary pill buttons are light (ink bg); Ask Claude is lime. Left icon
rail stays; on mobile it's a floating blurred dark pill.

(Prior direction, superseded — kept for reference: **Soft Light Dashboard**, Apple-clean, lime accent.) A real dashboard
app: a left icon rail + a light workspace of big rounded cards. Reference:
user-loved "Managing Your Team & Workflows" dashboard (light grey canvas, lime
pops, black pill buttons, huge bold display type, soft rounded stat cards) plus a
finance app's big-number + segmented-toggle + lime data viz. Elegant, clean,
futuristic-but-familiar, meant to age well.

## Theme
Light. Soft warm-grey canvas, near-white cards, one chartreuse/lime accent used
as deliberate pops (a highlighted card, active states, key data viz), not a wash.

## Color (OKLCH — same CSS var names, remapped to light dashboard)
- canvas `--paper` oklch(0.95 0.008 120) · card `--paper-2` ~white · pale `--paper-3`
- ink `--ink` oklch(0.22 0.012 130) near-black · soft/faint greys
- lines `--rule` / `--rule-strong`
- **accent lime** `--accent` oklch(0.90 0.18 118) · pale-lime card `--accent-soft` · deep-lime text `--accent-ink`
- `--dark` oklch(0.20 0.01 130) for the rail + primary pill buttons (black pills, light text)
- `--pos-ink` green (up/positive edge) · `--neg-ink` coral (avoid)
Lime stays a pop: an accent card, active nav, the strongest signal, primary data.

## Typography
- System humanist **sans** (Geist). Headline is **big and bold** (600-700), tight
  tracking, large scale, like the reference's display type.
- Numbers/data: tabular monospace (Geist Mono), aligned in columns.

## Layout & chrome (this is what makes it an app)
- **Left icon rail** (dark, ~76px, desktop): brand spark on top; Ask (scrolls to
  the chat); nav icons that ARE the market filters (Today/All, Hot, Coinflip,
  Soon); at the base, "Use in your own AI", How it works, and the Polymarket
  link. Active item highlighted.
- **Mobile is tabbed like Flighty**: the rail is replaced by a floating bottom
  tab bar of destinations (Markets / Ask / Hedge / Your AI). Each tap swaps the
  visible view instantly (no scroll slide). Inside Markets, the filters live as a
  chip row; the desktop stat cards are hidden on mobile. Sections are tagged
  `data-mv` and hidden per active `data-view` on `.main`.
- **Hedge calculator**: a standalone deterministic tool (no AI, no probability).
  Inputs = stake + both prices; outputs = the full-lock hedge stake, P/L each
  way, and an arbitrage flag when prices sum under 100c. Engine: `analyzeHedge`
  in scoring.ts.
- **Workspace** (light): big bold page title + a dark pill refresh button; a row
  of soft rounded **stat cards** (one lime) summarizing today; then a large white
  **panel** containing the ranked market rows. Tap a row to expand the edge/hedge
  calculator inline.
- Generous radii (cards ~22px, pills 999px), soft low shadows, airy spacing.

## Components
- Stat card: label + big mono number + a compact pill-dot meter (reference style).
- Panel: rounded white surface, header row, hairline-separated market rows.
- Row: rank · question · outcome odds (mono) · 24h vol · signal meter · chevron.
- Primary action = black pill button; accent = lime fills/active only.

## Motion
Minimal, ease-out. Press/hover on cards and rows via subtle shadow + transform.
Panel expand on opacity/transform. No bounce, no layout-property animation.

## Bans (enforced)
No neon, no glassmorphism, no gradient text, no side-stripe borders, no identical
dead-card grid, no modals-first, no em dashes in UI copy.
