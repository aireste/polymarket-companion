"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PlayDTO } from "@/lib/dto";
import { useBoard, useNow } from "@/lib/boardStore";
import { selectMarket, useIsDesktop, useSelectedId } from "@/lib/useSelection";
import { FILTERS, TIME_GROUPS, applyFilter, filterCount, timeGroup, type FilterId } from "@/lib/filters";
import { MARKET_TZ, clockLabel, countdownShort, isLive, price, whenMs } from "@/lib/format";
import { DeskDetail, Inspector } from "./Inspector";
import { JevPill } from "./JevPill";
import { Icon } from "./icons";
import { Odo } from "./Odo";
import { useSlider } from "@/lib/useSlider";
import { ThemeToggle } from "./ThemeToggle";
import { OddsToggle } from "./OddsToggle";
import { POLYMARKET_US } from "@/lib/links";
import { TodaysPick } from "./TodaysPick";
import { SubscribeBox } from "./SubscribeBox";
import { todaysPick } from "@/lib/pick";
import { JEV_ACTION_COPY, leanSide, shortSide } from "@/lib/jevDisplay";
import { Countdown } from "./Countdown";
import { useOddsFormat } from "@/lib/oddsFormat";

/** The market board for one filter route. Desktop: time list + detail. Phone: time board + sheet. */
export function Board({ filter }: { filter: FilterId }) {
  const desk = useIsDesktop();
  if (desk === null) return <div className="hp-boot" aria-hidden />;
  return desk ? <DeskBoard filter={filter} /> : <PhoneBoard filter={filter} />;
}

function useFocusedPlay(list: PlayDTO[], fallbackToFirst: boolean) {
  const { findPlay, addExtra, plays, reads } = useBoard();
  const pickId = todaysPick(plays, reads)?.play.id;
  const id = useSelectedId();
  const found = findPlay(id);

  // A shared link to a market that isn't on today's board: fetch it once.
  useEffect(() => {
    if (!id || found) return;
    let alive = true;
    fetch(`/api/market?id=${id}`)
      .then((r) => r.json())
      .then((d: { play?: PlayDTO }) => alive && d.play && addExtra(d.play))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, found, addExtra]);

  // With nothing in the URL, desktop opens on today's pick (if it's in this filter).
  const fallback = list.find((p) => p.id === pickId) ?? list[0] ?? null;
  return found ?? (fallbackToFirst ? fallback : null);
}

/** One plain sentence on how the board reads right now. */
function JevSummary({ plays }: { plays: PlayDTO[] }) {
  const { reads, jevStatus } = useBoard();
  const got = plays.filter((p) => reads[p.id]);
  const n = { wager: 0, hold: 0, skip: 0 };
  got.filter((p) => !reads[p.id].settled).forEach((p) => n[reads[p.id].action]++);

  let text: React.ReactNode;
  if (jevStatus === "loading" && got.length === 0) text = "Reading the board…";
  else if (jevStatus === "offline") text = "Calls are offline right now.";
  else if (got.length === 0) text = "Couldn't read the board just now.";
  else if (n.wager + n.hold === 0)
    text = (
      <>
        <b>Every market looks priced about right.</b> No side looks too cheap right now.
      </>
    );
  else
    text = (
      <>
        <b>{[n.wager && `${n.wager} to wager`, n.hold && `${n.hold} to lean on`].filter(Boolean).join(" · ")}</b>{" "}
        · {n.skip} look priced right.
      </>
    );

  return <p className="hp-summary">{text}</p>;
}

/* ─────────────────────────── Desktop: the Desk ─────────────────────────── */

/** Today's pick as one line at the top of the list; click to open it. */
function DeskPick() {
  const fmt = useOddsFormat();
  const { plays, reads } = useBoard();
  const pick = todaysPick(plays, reads);
  if (!pick) return null;
  const side = leanSide(pick.read);
  const a = JEV_ACTION_COPY[pick.read.action];
  return (
    <button className="hp-dpick" onClick={() => selectMarket(pick.play.id)}>
      <span className="hp-dpick-k">Today&apos;s pick</span>
      <b>
        {a.label} {side ? shortSide(side.label, 18) : ""} at {side ? price(side.price, fmt) : ""}
      </b>
      <small>{Math.round(pick.read.strength * 100)}% sure it&apos;s too cheap</small>
    </button>
  );
}

/** "52m" or "2h 52m" since a live game started. */
function sinceStart(p: PlayDTO, now: number) {
  const m = Math.max(0, Math.floor((now - whenMs(p)) / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** The time column: live time in, a countdown inside a day, else the date. */
function DeskWhen({ p, now }: { p: PlayDTO; now: number }) {
  if (isLive(p.gameStartTime, now)) {
    return (
      <span className="hp-dr-t is-live">
        Live<small>{sinceStart(p, now)} in</small>
      </span>
    );
  }
  const t = whenMs(p);
  if (!Number.isFinite(t)) return <span className="hp-dr-t">Open</span>;
  const tod = new Date(t).toLocaleTimeString("en-US", { timeZone: MARKET_TZ, hour: "numeric", minute: "2-digit" });
  const soon = t - now < 86_400_000;
  return (
    <span className="hp-dr-t num">
      {soon ? countdownShort(p, now) : clockLabel(p, now)}
      <small>{tod}</small>
    </span>
  );
}

function DeskBoard({ filter }: { filter: FilterId }) {
  const fmt = useOddsFormat();
  const { plays, loading, error, now, moves } = useBoard();
  const list = useMemo(() => (plays ? applyFilter(plays, filter, now) : []), [plays, filter, now]);
  const focused = useFocusedPlay(list, true);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const tabsRef = useRef<HTMLElement>(null);
  const ind = useSlider(tabsRef, '.hp-dtab[aria-current="page"]', [filter, plays?.length]);

  // Flighty order: grouped by when it resolves. "Hot" is a volume ranking, so it stays one list.
  const sections = useMemo(() => {
    if (filter === "hot") return [{ id: "all", label: "", rows: list }];
    return TIME_GROUPS.map((g) => ({
      id: g.id as string,
      label: g.label as string,
      rows: list.filter((p) => timeGroup(p, now) === g.id).sort((a, b) => whenMs(a) - whenMs(b)),
    })).filter((g) => g.rows.length > 0);
  }, [list, filter, now]);
  const order = useMemo(() => sections.flatMap((g) => g.rows), [sections]);

  const move = useCallback(
    (step: number) => {
      if (!order.length) return;
      const i = focused ? order.findIndex((p) => p.id === focused.id) : -1;
      const next = order[Math.min(order.length - 1, Math.max(0, i + step))];
      selectMarket(next.id);
      rowRefs.current.get(next.id)?.scrollIntoView({ block: "nearest" });
    },
    [order, focused]
  );

  // Arrow keys walk the list; typing in a field is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), move(1));
      if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), move(-1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  return (
    <div className="hp-desk">
      <aside className="hp-dlist" aria-label="Markets">
        <div className="hp-dlist-top">
          <p className="hp-dk">
            {new Date(now).toLocaleDateString("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "numeric" })}
          </p>
          <h1>What&apos;s resolving</h1>
          <nav className="hp-dtabs" aria-label="Filter markets" ref={tabsRef}>
            {ind && <span className="hp-dtabs-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden />}
            {FILTERS.map((x) => {
              const n = plays ? filterCount(plays, x.id, now) : null;
              return (
                <Link key={x.id} href={x.href} className="hp-dtab" aria-current={x.id === filter ? "page" : undefined}>
                  {x.label}
                  {n != null && <span>{n}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <DeskPick />
        {plays && <JevSummary plays={list} />}
        {error && <p className="state err">Couldn&apos;t load markets: {error}. Hit refresh to retry.</p>}
        {loading && !plays && Array.from({ length: 8 }).map((_, i) => <div key={i} className="hp-dr hp-dr-skl" aria-hidden />)}
        {plays && list.length === 0 && (
          <p className="hp-empty">
            {filter === "live"
              ? "No games are live right now. They show up here at first pitch, puck drop or kickoff."
              : "Nothing in this filter right now."}
          </p>
        )}

        {sections.map((g) => (
          <section key={g.id}>
            {g.label && <h2 className={`hp-dgrp${g.id === "live" ? " is-live" : ""}`}>{g.label}</h2>}
            {g.rows.map((p) => (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                className={`hp-dr${focused?.id === p.id ? " is-sel" : ""}`}
                onClick={() => selectMarket(p.id)}
                aria-current={focused?.id === p.id ? "true" : undefined}
              >
                <DeskWhen p={p} now={now} />
                <span className="hp-dr-mid">
                  <span className="hp-dr-q">{p.question}</span>
                  <JevPill id={p.id} />
                </span>
                <span className="hp-dr-px num">
                  <Odo value={price(p.outcomes[0]?.price ?? 0, fmt, "pct")} flash={moves[p.id]} />
                </span>
              </button>
            ))}
          </section>
        ))}

        <div className="hp-dlist-foot">
          <SubscribeBox compact source="board-desktop" />
          <div className="hp-keys">
            <a className="hp-pm-link" href={POLYMARKET_US} target="_blank" rel="noopener noreferrer" aria-label="Polymarket" title="Polymarket">
              <span className="hp-pm-tile">{Icon.polymarket}</span>
            </a>
          </div>
          <Credit />
        </div>
      </aside>

      <main className="hp-ddetail" aria-label="Market details">
        {focused ? <DeskDetail play={focused} /> : <div className="hp-insp-empty">Pick a market to see the call.</div>}
      </main>
    </div>
  );
}

/** "© 2026 Guerra Digital LLC", linking to estejg.com like SPCTR's footer. */
function Credit() {
  return (
    <span className="hp-credit">
      © {new Date().getFullYear()}{" "}
      <a href="https://estejg.com" target="_blank" rel="noopener noreferrer">
        Guerra Digital LLC
      </a>
    </span>
  );
}

/* ─────────────────────── Phone: the Departures board ─────────────────────── */

/** How many markets the phone board shows before "Show all". Soonest first, live on top. */
const PHONE_PEEK = 6;

function PhoneBoard({ filter }: { filter: FilterId }) {
  const fmt = useOddsFormat();
  const { plays, loading, error, now, setPaletteOpen, moves } = useBoard();
  const list = useMemo(() => (plays ? applyFilter(plays, filter, now) : []), [plays, filter, now]);
  const open = useFocusedPlay(list, false);
  const [showAll, setShowAll] = useState(false);
  const pushed = useRef(false);
  // Keep the last market rendered while the sheet slides away.
  const shown = useRef<PlayDTO | null>(null);
  if (open) shown.current = open;

  const openSheet = (id: string) => {
    pushed.current = true;
    selectMarket(id, "push");
  };
  const closeSheet = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else selectMarket(null);
  };

  // Lock page scroll behind the sheet.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const allGroups = TIME_GROUPS.map((g) => ({
    ...g,
    rows: list.filter((p) => timeGroup(p, now) === g.id).sort((a, b) => whenMs(a) - whenMs(b)),
  })).filter((g) => g.rows.length > 0);
  // Peek: the first PHONE_PEEK markets in board order (groups are already soonest-first).
  const limit = showAll ? Infinity : PHONE_PEEK;
  const starts = allGroups.map((_, i) => allGroups.slice(0, i).reduce((n, g) => n + g.rows.length, 0));
  const groups = allGroups
    .map((g, i) => ({ ...g, total: g.rows.length, rows: g.rows.slice(0, Math.max(0, limit - starts[i])) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className={`hp-phone${open ? " has-sheet" : ""}`}>
      <div className="hp-phone-board">
        <div className="hp-phone-top">
          <span className="hp-date">
            {new Date(now).toLocaleDateString("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "numeric" })}
          </span>
          <span className="hp-phone-tools">
            <OddsToggle />
            <ThemeToggle />
          </span>
        </div>
        <h1 className="hp-phone-title">What&apos;s resolving</h1>

        <button className="hp-searchbar" onClick={() => setPaletteOpen(true)}>
          {Icon.search}
          Search all of Polymarket
        </button>

        <Link href="/how-it-works" className="hp-howcard">
          <span className="hp-howcard-ic" aria-hidden>{Icon.spark}</span>
          <span className="hp-howcard-txt">
            <b>How HedgePredict works</b>
            <small>The calls, the odds, and the FAQ</small>
          </span>
          <span className="hp-howcard-go" aria-hidden>→</span>
        </Link>

        <TodaysPick variant="phone" onOpen={openSheet} />
        {plays && <NextUp plays={list} onOpen={openSheet} />}

        <nav className="hp-chips" aria-label="Filter markets">
          {FILTERS.map((x) => (
            <Link key={x.id} href={x.href} className="hp-chip" aria-current={x.id === filter ? "page" : undefined}>
              {x.id === "live" && plays?.some((p) => isLive(p.gameStartTime, now)) && <span className="hp-live-dot" aria-hidden />}
              {x.label}
            </Link>
          ))}
        </nav>

        {error && <p className="state err">Couldn&apos;t load markets: {error}.</p>}
        {loading && !plays && Array.from({ length: 4 }).map((_, i) => <div key={i} className="hp-fcard hp-fcard-skl" aria-hidden />)}
        {plays && list.length === 0 && (
          <p className="hp-empty">{filter === "live" ? "No games are live right now." : "Nothing in this filter right now."}</p>
        )}

        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="hp-group">
              {g.id === "live" && <span className="hp-live-dot" aria-hidden />}
              {g.label} · {g.total}
            </h2>
            {g.rows.map((p) => {
              const live = isLive(p.gameStartTime, now);
              const [a, b] = p.outcomes;
              return (
                <button key={p.id} className="hp-fcard" onClick={() => openSheet(p.id)}>
                  <span className={`hp-fcard-top${live ? " is-live" : ""}`}>
                    <b>{live ? "LIVE" : clockLabel(p, now)}</b>
                    <JevPill id={p.id} />
                  </span>
                  <span className="hp-fcard-q">{p.question}</span>
                  {live ? (
                    <LiveRail play={p} />
                  ) : (
                    <span className="hp-fcard-when">
                      <Countdown play={p} />
                    </span>
                  )}
                  <span className="hp-fcard-odds">
                    <span>
                      <b>
                        <Odo value={price(a?.price ?? 0, fmt, "pct", 0)} flash={moves[p.id]} />
                      </b>{" "}
                      {a?.label}
                    </span>
                    <span>{b ? `${b.label} ${price(b.price, fmt, "pct", 0)}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        {list.length > PHONE_PEEK && (
          <button className="hp-showall" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Show fewer ▴" : `Show all ${list.length} markets ▾`}
          </button>
        )}

        <section className="hp-dcard" aria-label="HedgePredict Daily">
          <Link href="/daily" className="hp-dcard-head">
            <span className="hp-dcard-ic" aria-hidden>{Icon.mail}</span>
            <span className="hp-dcard-txt">
              <b>The Daily</b>
              <small>The day&apos;s best pick, weekdays at 8 AM ET</small>
            </span>
            <span className="hp-howcard-go" aria-hidden>→</span>
          </Link>
          <SubscribeBox compact source="board-phone" />
        </section>

        <nav className="hp-phone-links" aria-label="More">
          <a href={POLYMARKET_US} target="_blank" rel="noopener noreferrer" aria-label="Polymarket" title="Polymarket">
            <span className="hp-pm-tile">{Icon.polymarket}</span>
          </a>
        </nav>
        <p className="hp-disc hp-phone-disc">
          Decision support, not financial advice. HedgePredict never places trades.
        </p>
        <Credit />
      </div>

      <div className="hp-scrim" onClick={closeSheet} aria-hidden />
      <div className="hp-sheet" role="dialog" aria-modal="true" aria-label={open?.question ?? "Market"}>
        <button className="hp-grab" onClick={closeSheet} aria-label="Close" />
        <div className="hp-sheet-in">{shown.current && <Inspector play={shown.current} pass />}</div>
      </div>
    </div>
  );
}

/** Live game progress, Flighty-style: a rail from first pitch with a moving marker (~3h game). */
function LiveRail({ play }: { play: PlayDTO }) {
  const now = useNow(1000);
  const start = whenMs(play);
  const frac = Math.min(1, Math.max(0, (now - start) / (3 * 3_600_000)));
  return (
    <span className="hp-rail is-live">
      <span>START</span>
      <span className="hp-rail-bar" aria-hidden>
        <b style={{ width: `${frac * 100}%` }} />
        <i style={{ left: `${frac * 100}%` }} />
      </span>
      <span>{Math.floor((now - start) / 60_000)}m in</span>
    </span>
  );
}

/** Flighty's "next flight" card: the next market to resolve, counting down live. */
function NextUp({ plays, onOpen }: { plays: PlayDTO[]; onOpen: (id: string) => void }) {
  const now = useNow(1000);
  const { reads, plays: all } = useBoard();
  const pickId = todaysPick(all, reads)?.play.id;
  // Don't repeat today's pick right under it.
  const next = plays
    .filter((p) => p.id !== pickId && !isLive(p.gameStartTime, now) && whenMs(p) > now)
    .sort((a, b) => whenMs(a) - whenMs(b))[0];
  if (!next) return null;
  const frac = Math.min(1, Math.max(0, 1 - (whenMs(next) - now) / (6 * 3_600_000)));
  return (
    <button className="hp-next" onClick={() => onOpen(next.id)}>
      <span className="hp-next-k">Next to resolve</span>
      <span className="hp-next-q">{next.question}</span>
      <span className="hp-next-cd">
        <Countdown play={next} bare />
        <small>to go</small>
      </span>
      <span className="hp-next-route">
        <span>NOW</span>
        <span className="hp-next-line" aria-hidden>
          <b style={{ width: `${frac * 100}%` }} />
          <i style={{ left: `${frac * 100}%` }} />
        </span>
        <span>{clockLabel(next, now)}</span>
      </span>
    </button>
  );
}
