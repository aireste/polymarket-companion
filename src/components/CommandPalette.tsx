"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { FILTERS } from "@/lib/filters";
import { pct } from "@/lib/format";
import { JevPill } from "./JevPill";
import { Icon } from "./icons";

type Item =
  | { kind: "market"; play: PlayDTO; onBoard: boolean }
  | { kind: "go"; label: string; href: string }
  | { kind: "ask"; q: string };

const GO: { label: string; href: string }[] = [
  ...FILTERS.map((f) => ({ label: f.id === "all" ? "Board" : f.label, href: f.href })),
  { label: "Ask", href: "/ask" },
  { label: "Hedge calculator", href: "/hedge" },
  { label: "Use in your AI", href: "/connect" },
];

/**
 * ⌘K on desktop, the search bar on the phone. Matches today's board instantly,
 * then searches all of Polymarket (off-board markets open in the same inspector),
 * and can hand the query to Ask.
 */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, plays, addExtra } = useBoard();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<PlayDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    setQ("");
    setRemote([]);
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [paletteOpen]);

  // Off-board search, debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { plays?: PlayDTO[] }) => setRemote(d.plays ?? []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 280);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return GO.map((g) => ({ kind: "go", ...g }));
    const words = term.split(/\s+/);
    const board = (plays ?? [])
      .filter((p) => words.every((w) => p.question.toLowerCase().includes(w)))
      .slice(0, 5);
    const onBoard = new Set((plays ?? []).map((p) => p.id));
    const off = remote.filter((p) => !onBoard.has(p.id)).slice(0, 6);
    return [
      ...board.map((play) => ({ kind: "market" as const, play, onBoard: true })),
      ...off.map((play) => ({ kind: "market" as const, play, onBoard: false })),
      { kind: "ask" as const, q: q.trim() },
    ];
  }, [q, plays, remote]);

  useEffect(() => setActive(0), [items.length]);

  if (!paletteOpen) return null;

  const close = () => setPaletteOpen(false);
  const choose = (it: Item) => {
    close();
    if (it.kind === "go") return router.push(it.href);
    if (it.kind === "ask") return router.push(`/ask?q=${encodeURIComponent(it.q)}`);
    if (!it.onBoard) addExtra(it.play);
    // Stay on the current board filter when it contains the market; else Today.
    const base = FILTERS.some((f) => f.href === path) && it.onBoard ? path : "/";
    router.push(`${base}?m=${it.play.id}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const boardHits = items.filter((i) => i.kind === "market" && i.onBoard);
  const offHits = items.filter((i) => i.kind === "market" && !i.onBoard);
  const row = (it: Item) => {
    const idx = items.indexOf(it);
    const cls = `hp-pal-it${idx === active ? " is-on" : ""}`;
    const common = {
      className: cls,
      onMouseEnter: () => setActive(idx),
      onClick: () => choose(it),
      role: "option",
      "aria-selected": idx === active,
    } as const;
    if (it.kind === "go")
      return (
        <button key={it.href} {...common}>
          <span>{it.label}</span>
          <span className="hp-pal-r">{it.href}</span>
        </button>
      );
    if (it.kind === "ask")
      return (
        <button key="ask" {...common}>
          <span className="hp-ico-sm">{Icon.ask}</span>
          <span>
            Ask HedgePredict: “{it.q}”
          </span>
          <span className="hp-pal-r">↵</span>
        </button>
      );
    return (
      <button key={it.play.id} {...common}>
        <span className="hp-pal-q">{it.play.question}</span>
        {it.onBoard && <JevPill id={it.play.id} />}
        <span className="hp-pal-r">{pct(it.play.outcomes[0]?.price ?? 0)}</span>
      </button>
    );
  };

  return (
    <div className="hp-pal-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="hp-pal" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}>
        <div className="hp-pal-in">
          {Icon.search}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets, or ask a question…"
            aria-label="Search markets"
            role="combobox"
            aria-expanded="true"
            aria-controls="hp-pal-list"
          />
          <button className="hp-pal-x" onClick={close}>
            Cancel
          </button>
        </div>
        <div className="hp-pal-list" id="hp-pal-list" role="listbox" ref={listRef}>
          {!q.trim() && <div className="hp-pal-sec">Go to</div>}
          {!q.trim() && items.map(row)}
          {boardHits.length > 0 && <div className="hp-pal-sec">On the board</div>}
          {boardHits.map(row)}
          {(offHits.length > 0 || searching) && (
            <div className="hp-pal-sec">All of Polymarket{searching ? " · searching…" : ""}</div>
          )}
          {offHits.map(row)}
          {q.trim() && (
            <>
              <div className="hp-pal-sec">Ask</div>
              {row(items[items.length - 1])}
            </>
          )}
        </div>
        <div className="hp-pal-ft">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
