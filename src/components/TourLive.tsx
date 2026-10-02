"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useBoard } from "@/lib/boardStore";
import { useOddsFormat } from "@/lib/oddsFormat";
import { MARKET_TZ, price, whenMs } from "@/lib/format";
import { TIME_GROUPS, timeGroup } from "@/lib/filters";
import { todaysPick } from "@/lib/pick";
import type { PlayDTO } from "@/lib/dto";
import { DeskWhen } from "./Board";
import { CallBig, LeanBar } from "./Inspector";
import { JevPill } from "./JevPill";
import { Odo } from "./Odo";
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

/** The real board list, today's markets, scrolling through as she describes it. */
export function LiveBoard({ lt, dur, fallback }: LiveProps) {
  const desk = useDesk();
  const fmt = useOddsFormat();
  const { plays, now, moves } = useBoard();
  if (!desk || !plays?.length) return fallback;
  // Same order and groups as the board: Live now, Next 24 hours, This week, Later.
  const groups = TIME_GROUPS.map((g) => ({
    id: g.id as string,
    label: g.label as string,
    rows: plays.filter((p) => timeGroup(p, now) === g.id).sort((a, b) => whenMs(a) - whenMs(b)),
  })).filter((g) => g.rows.length > 0);
  let n = 0;
  return (
    <div className="ts-live ts-live-board">
      <div className="hp-dlist">
        <div className="hp-dlist-top">
          <p className="hp-dk">{new Date(now).toLocaleDateString("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "numeric" })}</p>
          <h1>What&apos;s resolving</h1>
        </div>
        <AutoScroll p={progress(lt, dur, 1000, 600)} maxPx={220}>
          {groups.map((g) => (
            <section key={g.id}>
              {g.label && <h2 className={`hp-dgrp${g.id === "live" ? " is-live" : ""}`}>{g.label}</h2>}
              {g.rows.map((p) => (
                <div key={p.id} className={`hp-dr ts-live-row${shown(lt, 120 + n++ * 70)}`}>
                  <DeskWhen p={p} now={now} />
                  <span className="hp-dr-mid">
                    <span className="hp-dr-q">{p.question}</span>
                    <JevPill id={p.id} />
                  </span>
                  <span className="hp-dr-px num">
                    <Odo value={price(p.outcomes[0]?.price ?? 0, fmt, "pct")} flash={moves[p.id]} />
                  </span>
                </div>
              ))}
            </section>
          ))}
        </AutoScroll>
      </div>
    </div>
  );
}

/** One real market for each call, shown exactly as the market page shows it. */
export function LiveCalls({ lt, fallback }: LiveProps) {
  const desk = useDesk();
  const { plays, reads } = useBoard();
  const pickBy = (a: string) => plays?.find((p) => reads[p.id] && !reads[p.id].settled && reads[p.id].action === a);
  const trio = [pickBy("wager"), pickBy("hold"), pickBy("skip")];
  if (!desk || trio.some((p) => !p)) return fallback;
  return (
    <div className="ts-live ts-live-calls">
      {(trio as PlayDTO[]).map((p, i) => (
        <div key={p.id} className={`ts-live-call${shown(lt, 300 + i * 900)}`}>
          <span className="ts-k">{p.question}</span>
          <CallBig play={p} />
        </div>
      ))}
    </div>
  );
}

/** Today's pick with its real "how sure" bar filling in. */
export function LiveSure({ lt, fallback }: LiveProps) {
  const desk = useDesk();
  const { plays, reads } = useBoard();
  const pick = todaysPick(plays, reads);
  const read = pick ? reads[pick.play.id] : null;
  if (!desk || !pick || !read) return fallback;
  return (
    <div className="ts-live ts-live-sure hp-dd">
      <span className="ts-k">Today&apos;s pick</span>
      <b className="ts-live-sure-q">{pick.play.question}</b>
      <JevPill id={pick.play.id} long />
      <LeanBar read={read} shown={lt >= 900} />
    </div>
  );
}

/** Today's actual email, landing on "Sign up" and scrolling through. */
export function LiveDaily({ lt, dur, fallback, at }: LiveProps & { at: number }) {
  const desk = useDesk();
  const html = usePromise(getEmail);
  if (!desk || !html) return fallback;
  const doc = html.replace("<head>", '<head><base target="_blank">');
  return (
    <div className={`ts-live ts-live-mail${shown(lt, at)}`}>
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

/** Today's real pick, in words the chat demos can say. Null until the board's calls are in. */
export function useLivePick() {
  const fmt = useOddsFormat();
  const { plays, reads } = useBoard();
  const pick = todaysPick(plays, reads);
  const read = pick ? reads[pick.play.id] : null;
  if (!pick || !read || read.lean == null) return null;
  const side = read.sides[read.lean];
  const short = pick.play.question.length > 48 ? `${pick.play.question.slice(0, 46)}…` : pick.play.question;
  return {
    question: short,
    side: side.label,
    at: price(side.price, fmt),
    label: read.action === "wager" ? "Wager" : "Lean",
    cls: read.action === "wager" ? "is-wager" : "is-lean",
    sure: Math.round(read.strength * 100),
  };
}
