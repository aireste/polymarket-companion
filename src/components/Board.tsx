"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { selectMarket, useIsDesktop, useSelectedId } from "@/lib/useSelection";
import { FILTERS, TIME_GROUPS, applyFilter, filterById, filterCount, timeGroup, type FilterId } from "@/lib/filters";
import { clockLabel, countdown, isLive, pct, usd, whenMs } from "@/lib/format";
import { Inspector } from "./Inspector";
import { JevPill } from "./JevPill";
import { Sparkline } from "./Sparkline";
import { Status } from "./Status";
import { Icon } from "./icons";

/** The market board for one filter route. Desktop: table + inspector. Phone: time board + sheet. */
export function Board({ filter }: { filter: FilterId }) {
  const desk = useIsDesktop();
  if (desk === null) return <div className="hp-boot" aria-hidden />;
  return desk ? <DeskBoard filter={filter} /> : <PhoneBoard filter={filter} />;
}

function useFocusedPlay(list: PlayDTO[], fallbackToFirst: boolean) {
  const { findPlay, addExtra } = useBoard();
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

  return found ?? (fallbackToFirst ? list[0] ?? null : null);
}

function JevSummary({ plays }: { plays: PlayDTO[] }) {
  const { reads, jevStatus } = useBoard();
  const got = plays.filter((p) => reads[p.id]);
  const counts = { wager: 0, hold: 0, skip: 0 };
  got.forEach((p) => counts[reads[p.id].action]++);

  let text: React.ReactNode;
  if (jevStatus === "loading" && got.length === 0) text = "Jev is reading the board…";
  else if (jevStatus === "offline") text = "Jev is offline on this server.";
  else if (got.length === 0) text = "Jev couldn't read the board just now.";
  else if (counts.wager + counts.hold === 0)
    text = (
      <>
        <b>Jev passed on all {got.length}.</b> No clear mispricing on the board right now. That&apos;s a real answer, not a glitch.
      </>
    );
  else
    text = (
      <>
        <b>
          Jev likes {counts.wager} {counts.wager === 1 ? "market" : "markets"}
        </b>
        {counts.hold > 0 && `, is watching ${counts.hold}`} and passes on {counts.skip}.
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
  const { plays, loading, error, sparks, now } = useBoard();
  const f = filterById(filter);
  const list = useMemo(() => (plays ? applyFilter(plays, filter, now) : []), [plays, filter, now]);
  const focused = useFocusedPlay(list, true);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

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
          <nav className="hp-seg" aria-label="Filter markets">
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

        {plays && <JevSummary plays={plays} />}

        {error && <p className="state err">Couldn&apos;t load markets: {error}. Hit refresh to retry.</p>}

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
                  {pct(p.outcomes[0]?.price ?? 0)}
                  {p.outcomes[0] && p.outcomes[0].label.length <= 10 && <small>{p.outcomes[0].label}</small>}
                </td>
                <td className="hp-spark-cell">
                  <Sparkline points={sparks[p.outcomes[0]?.tokenId ?? ""]} />
                </td>
                <td>
                  <JevPill id={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
  const { plays, loading, error, now, setPaletteOpen } = useBoard();
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
            {new Date(now).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </span>
        </div>
        <h1 className="hp-phone-title">What&apos;s resolving</h1>

        <button className="hp-searchbar" onClick={() => setPaletteOpen(true)}>
          {Icon.search}
          Search all of Polymarket
        </button>

        <nav className="hp-chips" aria-label="Filter markets">
          {FILTERS.map((x) => (
            <Link key={x.id} href={x.href} className="hp-chip" aria-current={x.id === filter ? "page" : undefined}>
              {x.id === "live" && plays?.some((p) => isLive(p.gameStartTime, now)) && <span className="hp-live-dot" aria-hidden />}
              {x.label}
            </Link>
          ))}
        </nav>

        {plays && <JevSummary plays={plays} />}
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
                  <span className="hp-split" aria-hidden>
                    <i style={{ width: `${(a?.price ?? 0) * 100}%` }} />
                    <i style={{ width: `${(b?.price ?? 1 - (a?.price ?? 0)) * 100}%` }} />
                  </span>
                  <span className="hp-split-lbl">
                    <span>
                      <b>{pct(a?.price ?? 0, 0)}</b> {a?.label}
                    </span>
                    <span>{live ? "in play" : countdown(p, now)}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        <p className="hp-disc hp-phone-disc">
          Decision support, not financial advice. HedgePredict never places trades.
        </p>
      </div>

      <div className="hp-scrim" onClick={closeSheet} aria-hidden />
      <div className="hp-sheet" role="dialog" aria-modal="true" aria-label={open?.question ?? "Market"}>
        <button className="hp-grab" onClick={closeSheet} aria-label="Close" />
        <div className="hp-sheet-in">{shown.current && <Inspector play={shown.current} />}</div>
      </div>
    </div>
  );
}
