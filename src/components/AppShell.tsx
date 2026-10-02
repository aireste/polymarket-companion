"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoardProvider, useBoard, useNow } from "@/lib/boardStore";
import { clockET } from "@/lib/format";
import { FILTERS } from "@/lib/filters";
import { CommandPalette } from "./CommandPalette";
import { AskPanel } from "./AskPanel";
import { ThemeToggle } from "./ThemeToggle";
import { OddsToggle } from "./OddsToggle";
import { useSlider } from "@/lib/useSlider";
import { Icon } from "./icons";

const BOARD_PATHS = new Set(FILTERS.map((f) => f.href));

/**
 * The app frame. Desktop: a single header row (links, search, Ask, tools)
 * over the page. Phone: the page itself + a floating bottom tab bar. Every nav item
 * is a real route; the shared board data lives in BoardProvider so moving
 * between pages is instant.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BoardProvider>
      <div className="hp-app">
        <DeskHeader />
        <div className="hp-work">
          <main className="hp-main">
            <RouteFade>{children}</RouteFade>
          </main>
        </div>
        <TabBar />
        <CommandPalette />
        <PaletteHotkey />
      </div>
    </BoardProvider>
  );
}

/** Each page fades and rises in when you navigate (keyed on the path, not ?m=). */
function RouteFade({ children }: { children: ReactNode }) {
  const path = usePathname();
  const group = BOARD_PATHS.has(path) ? "board" : path;
  return (
    <div key={group} className="hp-route">
      {children}
    </div>
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

/** Live clock in Eastern Time, the zone Polymarket uses. */
function ClockET() {
  const now = useNow(1000);
  // The server's second never matches the browser's; render the time client-side only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <span className="hp-clock" title="All times are US Eastern, like Polymarket">
      {mounted ? clockET(now) : "\u00a0"} <small>ET</small>
    </span>
  );
}

/** Desktop links. Ask lives in its own dropdown so it opens over the board. */
const DESK_NAV = [
  { href: "/", label: "Board" },
  { href: "/hedge", label: "Hedge Lab" },
  { href: "/connect", label: "Your AI" },
  { href: "/daily", label: "The Daily" },
  { href: "/how-it-works", label: "How it works" },
];

/**
 * Desktop header: one row with the wordmark, section links, search, Ask, and
 * the clock/odds/theme/refresh tools. (Replaces the old sidebar + top bar.)
 */
function DeskHeader() {
  const path = usePathname();
  const { asOf, loading, refresh, setPaletteOpen } = useBoard();
  const navRef = useRef<HTMLElement>(null);
  const on = (href: string) => (href === "/" ? BOARD_PATHS.has(path) : path === href);
  const ind = useSlider(navRef, '.hp-dh-link[aria-current="page"]', [path]);

  return (
    <header className="hp-dh">
      <Link href="/" className="hp-dh-brand">
        <span className="hp-dh-mark" aria-hidden>{Icon.spark}</span>
        HedgePredict
      </Link>
      <nav className="hp-dh-nav" aria-label="Sections" ref={navRef}>
        {ind && <span className="hp-dh-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden />}
        {DESK_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="hp-dh-link" aria-current={on(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <button className="hp-search" onClick={() => setPaletteOpen(true)}>
        {Icon.search}
        Search all of Polymarket
        <kbd>⌘K</kbd>
      </button>
      <AskDropdown />
      <div className="hp-upd">
        <ClockET />
        <OddsToggle />
        <ThemeToggle />
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

/**
 * Ask from anywhere: the chat drops down under the button instead of leaving
 * the page. It stays mounted while closed, so the conversation is still there
 * when you reopen it. The full /ask page remains for the phone and long chats.
 */
function AskDropdown() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (path === "/ask") return null;

  return (
    <div className="hp-askwrap" ref={wrap}>
      <button
        className={`hp-ask-btn${open ? " is-open" : ""}`}
        onClick={() => {
          setUsed(true);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="hp-ask-mark">{Icon.spark}</span>
        Ask HedgePredict
        <span className="hp-ask-chev" aria-hidden>▾</span>
      </button>
      {used && (
        <div className={`hp-askdrop${open ? " is-open" : ""}`} role="dialog" aria-label="Ask HedgePredict" aria-hidden={!open}>
          <div className="hp-askdrop-head">
            <div>
              <b>Ask HedgePredict</b>
              <span>Straight calls on today&apos;s markets, explained.</span>
            </div>
            <Link href="/ask" className="hp-askdrop-full">
              Full page ↗
            </Link>
          </div>
          <AskPanel compact />
        </div>
      )}
    </div>
  );
}
