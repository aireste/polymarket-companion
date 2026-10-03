"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useOddsFormat } from "@/lib/oddsFormat";
import { price } from "@/lib/format";
import type { PlayDTO } from "@/lib/dto";
import { LeanBar } from "./Inspector";
import { Icon } from "./icons";

/**
 * Tour scenes built from the real app: the same board rows, calls, bars, Hedge
 * Lab and email people get, on today's live markets. Desktop only (the pieces
 * are the desktop layout); phones and any missing data fall back to the drawn
 * scene passed in, so the tour never shows an empty frame. (Hedge Lab keeps its drawn,
 * animated scene: it shows the hedge settling, which a still calculator can't.)
 */

type LiveProps = { lt: number; dur: number; fallback: ReactNode };

const DESK = "(min-width: 900px)";
function useDesk() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESK);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESK).matches,
    () => false
  );
}

/** 0 → 1 across the chapter, after a short settle and before a short rest. */
const progress = (lt: number, dur: number, from = 1200, rest = 1200) => Math.min(1, Math.max(0, (lt - from) / Math.max(1, dur - from - rest)));
const shown = (lt: number, ms: number) => (lt >= ms ? " on" : "");

/**
 * A tall element inside a fixed window, scrolled by the chapter clock (no real scrolling, so it's
 * smooth and exact). `maxPx` caps the distance so it drifts at a readable pace instead of racing to the end.
 */
function AutoScroll({ p, maxPx = Infinity, className, children }: { p: number; maxPx?: number; className?: string; children: ReactNode }) {
  const win = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  useLayoutEffect(() => {
    const measure = () => win.current && body.current && setMax(Math.min(maxPx, Math.max(0, body.current.scrollHeight - win.current.clientHeight)));
    measure();
    const ro = new ResizeObserver(measure);
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, [maxPx]);
  // Ease in and out so the scroll starts and lands gently.
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return (
    <div className={`ts-live-win ${className ?? ""}`} ref={win}>
      <div ref={body} style={{ transform: `translateY(${-e * max}px)` }}>
        {children}
      </div>
    </div>
  );
}

/* ── Data the tour fetches once, when someone presses play ── */

let emailHtml: Promise<string | null> | null = null;
let searchHits: Promise<PlayDTO[]> | null = null;
const SEARCH_TERM = "fed rates";
export function prefetchTourLive() {
  emailHtml ??= fetch("/api/newsletter/preview")
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null);
  searchHits ??= fetch(`/api/search?q=${encodeURIComponent(SEARCH_TERM)}`)
    .then((r) => r.json())
    .then((d: { plays?: PlayDTO[] }) => (d.plays ?? []).slice(0, 5))
    .catch(() => []);
}
function usePromise<T>(get: () => Promise<T> | null): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    let live = true;
    get()?.then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, [get]);
  return v;
}
const getEmail = () => emailHtml;
const getHits = () => searchHits;

/* ── Scenes ── */

/** Today's actual email, landing on "Sign up" and scrolling through. */
export function LiveDaily({ lt, dur, fallback, at }: LiveProps & { at: number }) {
  const desk = useDesk();
  const html = usePromise(getEmail);
  if (!desk || !html) return fallback;
  const doc = html.replace("<head>", '<head><base target="_blank">');
  return (
    <div className={`ts-live ts-live-mail${shown(lt, 150)}`}>
      <div className="hp-ep-window">
        <div className="hp-ep-chrome" aria-hidden>
          <i />
          <i />
          <i />
          <span>Inbox</span>
        </div>
        <AutoScroll p={progress(lt, dur, at + 1000, 400)} maxPx={420}>
          <iframe title="Today's HedgePredict Daily" srcDoc={doc} sandbox="" tabIndex={-1} />
        </AutoScroll>
      </div>
    </div>
  );
}

/** The real search palette finding live markets across Polymarket. */
export function LiveSearch({ lt, fallback, at }: LiveProps & { at: number }) {
  const desk = useDesk();
  const fmt = useOddsFormat();
  const hits = usePromise(getHits);
  if (!desk || !hits?.length) return fallback;
  const typed = SEARCH_TERM.slice(0, Math.max(0, Math.floor((lt - 500) / 60)));
  return (
    <div className="ts-live ts-live-pal">
      <div className="hp-pal">
        <div className="hp-pal-in">
          {Icon.search}
          <span className="ts-live-q">{typed || <i className="ts-caret" aria-hidden />}</span>
        </div>
        <div className="hp-pal-list">
          <div className={`hp-pal-sec ts-live-row${shown(lt, at)}`}>All of Polymarket</div>
          {hits.map((p, i) => (
            <div key={p.id} className={`hp-pal-it ts-live-row${shown(lt, at + 120 + i * 140)}`}>
              <span className="hp-pal-q">{p.question}</span>
              <span className="hp-pal-r">{price(p.outcomes[0]?.price ?? 0, fmt, "pct")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Fixed examples in the real board's style: the same every time, so the format never shifts ── */

const EX_BOARD: { group: string; live?: boolean; t: string; sub: string; q: string; call: "wager" | "hold" | "skip"; side?: string; px: string }[] = [
  { group: "Live now", live: true, t: "Live", sub: "1h 12m in", q: "Yankees vs. Rays", call: "skip", px: "55.0%" },
  { group: "Next 24 hours", t: "2h 15m", sub: "7:00 PM", q: "Kentucky vs. South Carolina", call: "wager", side: "Kentucky", px: "43.0%" },
  { group: "Next 24 hours", t: "5h 40m", sub: "10:30 PM", q: "Chiefs vs. Raiders", call: "hold", side: "Chiefs", px: "66.0%" },
  { group: "Next 24 hours", t: "9h 05m", sub: "1:55 AM", q: "Bitcoin above $90k on Friday?", call: "hold", side: "Yes", px: "31.0%" },
  { group: "This week", t: "Oct 9", sub: "2:00 PM", q: "Fed cuts rates in December?", call: "skip", px: "62.0%" },
  { group: "This week", t: "Oct 10", sub: "8:00 PM", q: "Lakers vs. Warriors", call: "wager", side: "Warriors", px: "48.0%" },
  { group: "This week", t: "Oct 11", sub: "11:59 PM", q: "Will Ethereum close above $4k?", call: "skip", px: "39.0%" },
];
const CALL_WORD = { wager: "Wager", hold: "Lean", skip: "Skip" } as const;

/** The board, as a fixed example in the real board's rows. */
export function ExampleBoard({ lt, dur, fallback }: LiveProps) {
  const desk = useDesk();
  if (!desk) return fallback;
  // Show a group heading on the first row of each group.
  const heads = EX_BOARD.map((r, i) => i === 0 || EX_BOARD[i - 1].group !== r.group);
  return (
    <div className="ts-live ts-live-board">
      <div className="hp-dlist">
        <div className="hp-dlist-top">
          <p className="hp-dk">Today</p>
          <h1>What&apos;s resolving</h1>
        </div>
        <AutoScroll p={progress(lt, dur, 1000, 600)} maxPx={160}>
          {EX_BOARD.map((r, i) => {
            const head = heads[i] ? <h2 className={`hp-dgrp${r.live ? " is-live" : ""}`}>{r.group}</h2> : null;
            return (
              <div key={r.q}>
                {head}
                <div className={`hp-dr ts-live-row${shown(lt, 120 + i * 90)}`}>
                  <span className={`hp-dr-t num${r.live ? " is-live" : ""}`}>
                    {r.t}
                    <small>{r.sub}</small>
                  </span>
                  <span className="hp-dr-mid">
                    <span className="hp-dr-q">{r.q}</span>
                    <span className={`hp-jev hp-jev-${r.call}`}>
                      {CALL_WORD[r.call]}
                      {r.side && <span className="hp-jev-side">{r.side}</span>}
                    </span>
                  </span>
                  <span className="hp-dr-px num">{r.px}</span>
                </div>
              </div>
            );
          })}
        </AutoScroll>
      </div>
    </div>
  );
}

/** The three calls, one fixed example each, same format and length so nothing jumps. */
const EX_CALLS = [
  { q: "Kentucky vs. South Carolina", call: "wager", mean: <><em>Kentucky</em> looks too cheap.</>, sure: "72% sure it's too cheap" },
  { q: "Bitcoin above $90k on Friday?", call: "hold", mean: <><em>Yes</em> looks a bit cheap.</>, sure: "41% sure it's too cheap" },
  { q: "Fed cuts rates in December?", call: "skip", mean: <>Both prices look fair.</>, sure: "61% sure both are fair" },
] as const;

/** Each call lands as she names it (`at`: ms into the chapter, one per card). */
export function ExampleCalls({ lt, at, fallback }: Omit<LiveProps, "dur"> & { at: number[] }) {
  const desk = useDesk();
  if (!desk) return fallback;
  return (
    <div className="ts-live ts-live-calls">
      {EX_CALLS.map((c, i) => (
        <div key={c.q} className={`ts-live-call${shown(lt, at[i] - 150)}`}>
          <span className="ts-k">{c.q}</span>
          <div className={`hp-dd-big hp-dd-call is-${c.call}`}>
            <b>{CALL_WORD[c.call]}</b>
            <span className="hp-dd-mean">{c.mean}</span>
            <small>{c.sure}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

/** How sure: one fixed pick with the real split bar. */
const EX_READ = {
  marketId: "tour-example",
  marketName: "Kentucky vs. South Carolina",
  sides: [
    { label: "Kentucky", price: 0.43 },
    { label: "South Carolina", price: 0.58 },
  ],
  lean: 0,
  strength: 0.72,
  distribution: { sides: [0.72, 0.03], neither: 0.25 },
  action: "wager" as const,
  confidence: 0.6,
  model: "example",
};

export function ExampleSure({ lt, fallback }: Omit<LiveProps, "dur">) {
  const desk = useDesk();
  if (!desk) return fallback;
  return (
    <div className="ts-live ts-live-sure hp-dd">
      <span className="ts-k">Today&apos;s pick</span>
      <b className="ts-live-sure-q">Kentucky vs. South Carolina</b>
      <span className="hp-jev hp-jev-wager">
        Wager<span className="hp-jev-side">Kentucky</span>
      </span>
      <LeanBar read={EX_READ} shown={lt >= 900} />
    </div>
  );
}
