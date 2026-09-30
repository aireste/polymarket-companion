"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { PlayDTO } from "@/lib/dto";
import { useBoard, useNow } from "@/lib/boardStore";
import { selectMarket, useIsDesktop, useSelectedId } from "@/lib/useSelection";
import { FILTERS, TIME_GROUPS, applyFilter, filterById, filterCount, timeGroup, type FilterId } from "@/lib/filters";
import { MARKET_TZ, clockLabel, isLive, pct, usd, whenMs } from "@/lib/format";
import { Inspector } from "./Inspector";
import { JevPill } from "./JevPill";
import { Sparkline } from "./Sparkline";
import { Status } from "./Status";
import { Icon } from "./icons";
import { Odo } from "./Odo";
import { QuickStart } from "./QuickStart";
import { useSlider } from "@/lib/useSlider";
import { ThemeToggle } from "./ThemeToggle";
import { TodaysPick } from "./TodaysPick";
import { SubscribeBox } from "./SubscribeBox";
import { todaysPick } from "@/lib/pick";
import { Countdown } from "./Countdown";

/** The market board for one filter route. Desktop: table + inspector. Phone: time board + sheet. */
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

/** One plain sentence on how Jev reads the board right now. */
function JevSummary({ plays }: { plays: PlayDTO[] }) {
  const { reads, jevStatus } = useBoard();
  const got = plays.filter((p) => reads[p.id]);
  const n = { wager: 0, hold: 0, skip: 0 };
  got.filter((p) => !reads[p.id].settled).forEach((p) => n[reads[p.id].action]++);

  let text: React.ReactNode;
  if (jevStatus === "loading" && got.length === 0) text = "Jev is reading the board…";
  else if (jevStatus === "offline") text = "Jev is offline on this server.";
  else if (got.length === 0) text = "Jev couldn't read the board just now.";
  else if (n.wager + n.hold === 0)
    text = (
      <>
        <b>Jev sees every market as priced about right.</b> No side looks underpriced right now.
      </>
    );
  else
    text = (
      <>
        <b>{[n.wager && `Jev backs ${n.wager}`, n.hold && `${n.wager ? "leans on" : "Jev leans on"} ${n.hold}`].filter(Boolean).join(" · ")}</b>{" "}
        · {n.skip} look priced right.
      </>
    );

  return (
    <div className="hp-summary">
      <span className="hp-brand-mark hp-brand-sm">{Icon.spark}</span>
      <span>{text}</span>
    </div>
  );
}

/* ─────────────────────────── Desktop: the Desk ─────────────────────────── */

function DeskBoard({ filter }: { filter: FilterId }) {
  const { plays, loading, error, sparks, now, moves, jevReadAt } = useBoard();
  const f = filterById(filter);
  const list = useMemo(() => (plays ? applyFilter(plays, filter, now) : []), [plays, filter, now]);
  const focused = useFocusedPlay(list, true);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const segRef = useRef<HTMLElement>(null);
  const thumb = useSlider(segRef, '.hp-seg-btn[aria-current="page"]', [filter, plays?.length]);

  const move = useCallback(
    (step: number) => {
      if (!list.length) return;
      const i = focused ? list.findIndex((p) => p.id === focused.id) : -1;
      const next = list[Math.min(list.length - 1, Math.max(0, i + step))];
      selectMarket(next.id);
      rowRefs.current.get(next.id)?.scrollIntoView({ block: "nearest" });
    },
    [list, focused]
  );

  // Arrow keys walk the table; typing in a field is left alone.
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
      <div className="hp-list">
        <div className="hp-list-head">
          <div>
            <h1>{f.title}</h1>
            <p>{f.caption}</p>
          </div>
          <nav className="hp-seg" aria-label="Filter markets" ref={segRef}>
            {thumb && (
              <span className="hp-seg-thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} aria-hidden />
            )}
            {FILTERS.map((x) => {
              const n = plays ? filterCount(plays, x.id, now) : null;
              return (
                <Link key={x.id} href={x.href} className="hp-seg-btn" aria-current={x.id === filter ? "page" : undefined}>
                  {x.id === "live" && n ? <span className="hp-live-dot" aria-hidden /> : null}
                  {x.label}
                  {n != null && <span className="hp-seg-n">{n}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <QuickStart />
        <TodaysPick variant="desk" />
        {plays && <JevSummary plays={list} />}

        {error && <p className="state err">Couldn&apos;t load markets: {error}. Hit refresh to retry.</p>}

        <div className="hp-table-wrap">
        {/* Replays each time Jev's board read lands: a sweep down the table. */}
        {jevReadAt && list.length > 0 && (
          <span key={jevReadAt} className="hp-beam" style={{ animationDuration: `${220 + list.length * 90}ms` }} aria-hidden />
        )}
        <table className="hp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Market</th>
              <th>Price</th>
              <th>1W</th>
              <th>Jev</th>
            </tr>
          </thead>
          <tbody>
            {loading && !plays &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="hp-skl-row" aria-hidden>
                  <td colSpan={5}>
                    <span className="bar" style={{ width: `${70 - i * 4}%` }} />
                  </td>
                </tr>
              ))}
            {plays && list.length === 0 && (
              <tr>
                <td colSpan={5} className="hp-empty">
                  {filter === "live"
                    ? "No games are live right now. They show up here at first pitch, puck drop or kickoff."
                    : "Nothing in this filter right now."}
                </td>
              </tr>
            )}
            {list.map((p, i) => (
              <tr
                key={p.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                className={focused?.id === p.id ? "is-sel" : undefined}
                onClick={() => selectMarket(p.id)}
                aria-selected={focused?.id === p.id}
              >
                <td className="hp-rk">{String(i + 1).padStart(2, "0")}</td>
                <td>
                  <div className="hp-q">{p.question}</div>
                  <div className="hp-meta">
                    <Status play={p} now={now} />
                    <span>24h {usd(p.volume24hr)}</span>
                  </div>
                </td>
                <td className="hp-odds">
                  <Odo value={pct(p.outcomes[0]?.price ?? 0)} flash={moves[p.id]} />
                  {p.outcomes[0] && p.outcomes[0].label.length <= 10 && <small>{p.outcomes[0].label}</small>}
                  {moves[p.id] && Math.abs(moves[p.id].delta) >= 0.001 && (
                    <span className={`hp-delta ${moves[p.id].delta > 0 ? "up" : "dn"}`}>
                      {moves[p.id].delta > 0 ? "▲" : "▼"}
                      {Math.abs(moves[p.id].delta * 100).toFixed(1)}
                    </span>
                  )}
                </td>
                <td className="hp-spark-cell">
                  <Sparkline points={sparks[p.outcomes[0]?.tokenId ?? ""]} />
                </td>
                <td>
                  <span key={jevReadAt ?? 0} className="hp-scan-pop" style={{ animationDelay: `${120 + i * 90}ms` }}>
                    <JevPill id={p.id} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <SubscribeBox compact />

        <div className="hp-keys">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>⌘K</kbd> search all of Polymarket
          </span>
        </div>
      </div>

      <aside className="hp-insp" aria-label="Market details">
        {focused ? <Inspector play={focused} /> : <div className="hp-insp-empty">Pick a market to see Jev&apos;s call.</div>}
      </aside>
    </div>
  );
}

/* ─────────────────────── Phone: the Departures board ─────────────────────── */

function PhoneBoard({ filter }: { filter: FilterId }) {
  const { plays, loading, error, now, setPaletteOpen, moves } = useBoard();
  const list = useMemo(() => (plays ? applyFilter(plays, filter, now) : []), [plays, filter, now]);
  const open = useFocusedPlay(list, false);
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

  const groups = TIME_GROUPS.map((g) => ({
    ...g,
    rows: list.filter((p) => timeGroup(p, now) === g.id).sort((a, b) => whenMs(a) - whenMs(b)),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className={`hp-phone${open ? " has-sheet" : ""}`}>
      <div className="hp-phone-board">
        <div className="hp-phone-top">
          <span className="hp-date">
            {new Date(now).toLocaleDateString("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "numeric" })}
          </span>
          <ThemeToggle />
        </div>
        <h1 className="hp-phone-title">What&apos;s resolving</h1>

        <button className="hp-searchbar" onClick={() => setPaletteOpen(true)}>
          {Icon.search}
          Search all of Polymarket
        </button>

        <QuickStart />
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
              {g.label} · {g.rows.length}
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
                        <Odo value={pct(a?.price ?? 0, 0)} flash={moves[p.id]} />
                      </b>{" "}
                      {a?.label}
                    </span>
                    <span>{b ? `${b.label} ${pct(b.price, 0)}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        <SubscribeBox compact />
        <nav className="hp-phone-links" aria-label="More">
          <Link href="/daily">The Daily</Link>
          <Link href="/how-it-works">How it works</Link>
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer">
            <span className="hp-pm-tile">{Icon.polymarket}</span>
            Polymarket ↗
          </a>
        </nav>
        <p className="hp-disc hp-phone-disc">
          Decision support, not financial advice. HedgePredict never places trades.
        </p>
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
