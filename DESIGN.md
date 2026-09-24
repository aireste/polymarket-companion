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
  tab bar of THREE destinations (Markets / Ask / Your AI). Each tap swaps the
  visible view instantly (no scroll slide). Inside Markets, the four filters live
  as a chip row; the desktop stat cards are hidden on mobile.
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
