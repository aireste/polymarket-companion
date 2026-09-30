"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoardProvider, useBoard, useNow } from "@/lib/boardStore";
import { clockET } from "@/lib/format";
import { FILTERS, filterCount } from "@/lib/filters";
import { CommandPalette } from "./CommandPalette";
import { Icon } from "./icons";

const BOARD_PATHS = new Set(FILTERS.map((f) => f.href));

const TOOLS = [
  { href: "/ask", label: "Ask", icon: Icon.ask },
  { href: "/hedge", label: "Hedge calc", icon: Icon.hedge },
  { href: "/connect", label: "Use in your AI", icon: Icon.connect },
];

const PAGE_TITLES: Record<string, string> = {
  "/ask": "Ask",
  "/hedge": "Hedge calculator",
  "/connect": "Use in your AI",
  "/how-it-works": "How it works",
};

/**
 * The app frame. Desktop: dark labeled sidebar + top bar (breadcrumb, search,
 * refresh). Phone: the page itself + a floating bottom tab bar. Every nav item
 * is a real route; the shared board data lives in BoardProvider so moving
 * between pages is instant.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BoardProvider>
      <div className="hp-app">
        <Sidebar />
        <div className="hp-work">
          <TopBar />
          <main className="hp-main">{children}</main>
        </div>
        <TabBar />
        <CommandPalette />
        <PaletteHotkey />
      </div>
    </BoardProvider>
  );
}

function PaletteHotkey() {
  const { paletteOpen, setPaletteOpen } = useBoard();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);
  return null;
}

function Sidebar() {
  const path = usePathname();
  const { plays, jevStatus, reads, now } = useBoard();
  const liveN = plays ? filterCount(plays, "live", now) : null;
  const model = Object.values(reads)[0]?.model;

  return (
    <nav className="hp-side" aria-label="Sections">
      <Link href="/" className="hp-brand">
        <span className="hp-brand-mark">{Icon.spark}</span>
        HedgePredict
      </Link>

      <div className="hp-side-grp">Markets</div>
      {FILTERS.map((f) => {
        const n = plays ? filterCount(plays, f.id, now) : null;
        return (
          <Link key={f.id} href={f.href} className="hp-nav" title={f.id === "all" ? "Board" : f.label} aria-current={path === f.href ? "page" : undefined}>
            {Icon[f.id === "all" ? "board" : f.id]}
            {f.id === "all" ? "Board" : f.label}
            {f.id === "live" && liveN ? <span className="hp-live-dot" aria-hidden /> : null}
            {n != null && <span className="hp-nav-n">{n}</span>}
          </Link>
        );
      })}

      <div className="hp-side-grp">Tools</div>
      {TOOLS.map((t) => (
        <Link key={t.href} href={t.href} className="hp-nav" title={t.label} aria-current={path === t.href ? "page" : undefined}>
          {t.icon}
          {t.label}
        </Link>
      ))}

      <span className="hp-grow" />
      <Link href="/how-it-works" className="hp-nav" title="How it works" aria-current={path === "/how-it-works" ? "page" : undefined}>
        {Icon.help}
        How it works
      </Link>
      <a className="hp-nav" title="Polymarket" href="https://polymarket.com" target="_blank" rel="noopener noreferrer">
        {Icon.ext}
        Polymarket
      </a>
      <div className={`hp-engine is-${jevStatus}`}>
        <b>
          <i aria-hidden />
          {jevStatus === "ready" ? "Jev online" : jevStatus === "loading" ? "Jev reading…" : "Jev offline"}
        </b>
        <span>{model ?? "calibrated decision model"}</span>
      </div>
    </nav>
  );
}

/** Live clock in Eastern Time, the zone Polymarket uses. */
function ClockET() {
  const now = useNow(1000);
  return (
    <span className="hp-clock" title="All times are US Eastern, like Polymarket">
      {clockET(now)} <small>ET</small>
    </span>
  );
}

function TopBar() {
  const path = usePathname();
  const { asOf, loading, refresh, setPaletteOpen } = useBoard();
  const f = FILTERS.find((x) => x.href === path);

  return (
    <header className="hp-top">
      <div className="hp-crumb">
        {f ? (
          <>
            <Link href="/">Board</Link>
            <span aria-hidden>›</span>
            <b>{f.label}</b>
          </>
        ) : (
          <b>{PAGE_TITLES[path] ?? "HedgePredict"}</b>
        )}
      </div>
      <button className="hp-search" onClick={() => setPaletteOpen(true)}>
        {Icon.search}
        Search all of Polymarket…
        <kbd>⌘K</kbd>
      </button>
      <div className="hp-upd">
        <Link href="/ask" className="pill hp-pill-lime hp-ask-btn">
          <span className="hp-ico-sm">{Icon.ask}</span>
          Ask HedgePredict
        </Link>
        <ClockET />
        <button
          className="hp-iconbtn"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh markets"
          title={asOf ? `Prices update every 20s · last ${new Date(asOf).toLocaleTimeString("en-US", { timeZone: "America/New_York" })} ET` : undefined}
        >
          <span className={loading ? "hp-spin" : undefined}>{Icon.refresh}</span>
        </button>
      </div>
    </header>
  );
}

function TabBar() {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Board", icon: Icon.board, on: BOARD_PATHS.has(path) },
    { href: "/ask", label: "Ask", icon: Icon.ask, on: path === "/ask" },
    { href: "/hedge", label: "Hedge", icon: Icon.hedge, on: path === "/hedge" },
    { href: "/connect", label: "Your AI", icon: Icon.connect, on: path === "/connect" },
  ];
  return (
    <nav className="hp-tabs" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="hp-tab" aria-current={t.on ? "page" : undefined}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
