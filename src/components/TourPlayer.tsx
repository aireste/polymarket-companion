"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import brielle from "@/lib/tour/brielle.json";
import { HedgeLabMark } from "./HedgeLabMark";
import { ExampleBoard, ExampleCalls, ExampleSure, LiveDaily, LiveSearch, prefetchTourLive } from "./TourLive";

/**
 * The How it works tour: a ~1:15 "video" drawn in code (real type, real colors,
 * light/dark aware) with an optional voiceover: one continuous take by Brielle
 * (ElevenLabs, natural American), public/tour/tour.m4a. Nothing moves until someone
 * presses play, and sound only plays if they choose it. Scrub, skip 10s, jump by
 * chapter, captions on/off. It pauses when scrolled away and rests on the last
 * frame when done. Scenes read `lt` (ms into the chapter) and flip classes at
 * beats; CSS transitions do the motion.
 */

/* Timing comes from the take: record_tour.py writes one file per voice (line starts, word-tied beats,
   captions, all in seconds). The first voice is the default; ?voice=NAME picks another (for comparing takes). */
type Timing = { audio: string; lineAt: number[]; end: number; beats: Record<string, number>; caps: [number, string][] };
// JSON infers captions as (string | number)[][]; the generator writes [seconds, text] pairs.
const TAKES: Record<string, Timing> = { brielle: brielle as unknown as Timing };
const asked = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("voice") : null;
const TAKE = TAKES[asked ?? ""] ?? TAKES.brielle;
const LINE_AT = TAKE.lineAt;
const AUDIO_END = TAKE.end;
/** Chapters open a beat before their line, so the picture lands as she starts speaking. */
const LEAD = 250;
/** Chapters held a little past their line, so the previous scene can be read (ms). The closing card waits a second for the AI answer. */
const HOLD: Record<number, number> = { 9: 1000 };
const START = LINE_AT.map((s, i) => (i === 0 ? 0 : Math.round(s * 1000) - LEAD + (HOLD[i] ?? 0)));
/** A short rest on the closing card after the last word. */
const TOTAL = Math.round(AUDIO_END * 1000) + 1500;
const DUR = START.map((s, i) => (START[i + 1] ?? TOTAL) - s);
/** In-chapter beats tied to words (ms after the chapter opens). */
const beat = (k: string) => Math.round((TAKE.beats[k] ?? 0) * 1000) + LEAD;
/** Captions, YouTube-style: one short phrase at a time, each shown from when she starts saying it (s). */
const CAPS = TAKE.caps;

type SceneProps = { lt: number; dur: number };
const CHAPTERS: { tab: string; Scene: (p: SceneProps) => ReactNode }[] = [
  { tab: "Hi", Scene: Hello },
  { tab: "Prices", Scene: Prices },
  { tab: "Odds", Scene: Odds },
  { tab: "The board", Scene: Board },
  { tab: "Calls", Scene: Calls },
  { tab: "Hedge Lab", Scene: Hedge },
  { tab: "The Daily", Scene: Daily },
  { tab: "Search & Ask", Scene: SearchAsk },
  { tab: "Connect AI", Scene: Ai },
  { tab: "That's it", Scene: End },
];
/** Where each chapter starts (ms), for links that jump into the tour. */
export const TOUR_AT = Object.fromEntries(CHAPTERS.map((c, i) => [c.tab, START[i]])) as Record<string, number>;
/** Ask the tour to play from a chapter (e.g. from the text version below it). */
export const playTourAt = (tab: string) => window.dispatchEvent(new CustomEvent("hp-tour-play", { detail: tab }));
const chapterAt = (t: number) => Math.max(0, START.findLastIndex((s) => t >= s));
const CC_KEY = "hp_tour_cc";
const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function TourPlayer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const tRef = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [cc, setCc] = useState(true);
  // Captions: on by default, remembered per browser.
  useEffect(() => {
    try {
      if (localStorage.getItem(CC_KEY) === "0") {
        const id = setTimeout(() => setCc(false), 0);
        return () => clearTimeout(id);
      }
    } catch {
      /* default on */
    }
  }, []);
  const toggleCc = () =>
    setCc((v) => {
      try {
        localStorage.setItem(CC_KEY, v ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !v;
    });

  // The clock: advance only while playing; stop on the last frame.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current == null ? 0 : now - last.current;
      last.current = now;
      // With the voice playing, its clock is the clock (no drift); otherwise count frames.
      const a = audio.current;
      const heard = a && !a.paused && !a.ended ? a.currentTime * 1000 : null;
      setT((cur) => {
        const next = Math.min(TOTAL, heard ?? cur + dt);
        if (next >= TOTAL) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing]);

  // Scrolled out of view: pause (it never plays unseen).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => !e.isIntersecting && setPlaying(false), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = useCallback(() => {
    setStarted(true);
    prefetchTourLive();
    if (t >= TOTAL) {
      setT(0);
      if (audio.current) audio.current.currentTime = 0;
    }
    setPlaying((p) => !p || t >= TOTAL);
  }, [t]);
  const start = (withSound: boolean) => {
    setSound(withSound);
    toggle();
  };
  /** Move the playhead (scrubber, ±10s, chapters); the voice follows. */
  const seek = (ms: number) => {
    const to = Math.min(TOTAL - 1, Math.max(0, ms));
    setStarted(true);
    setT(to);
    tRef.current = to;
    if (audio.current) audio.current.currentTime = Math.min(to / 1000, AUDIO_END);
  };
  const jump = (i: number) => {
    prefetchTourLive();
    seek(START[i]);
    setPlaying(true);
  };
  // A text row below asked to play from a chapter: bring the player into view and play with sound
  // (the click that sent it counts as the user's go-ahead for audio).
  const jumpRef = useRef(jump);
  useEffect(() => {
    jumpRef.current = jump;
  });
  useEffect(() => {
    const onPlay = (e: Event) => {
      const i = CHAPTERS.findIndex((c) => c.tab === (e as CustomEvent<string>).detail);
      if (i < 0) return;
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setSound(true);
      prefetchTourLive();
      jumpRef.current(i);
    };
    window.addEventListener("hp-tour-play", onPlay);
    return () => window.removeEventListener("hp-tour-play", onPlay);
  }, []);

  const done = t >= TOTAL;
  // Before the first play, show chapter 1 fully drawn as the poster.
  const ch = started ? Math.min(CHAPTERS.length - 1, chapterAt(t)) : 0;
  const lt = started ? (done ? DUR[ch] : t - START[ch]) : DUR[0];
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Voice: one continuous take. Start it from wherever the clock is; it only
  // loads once someone turns sound on.
  useEffect(() => {
    if (!playing || !sound || !started) {
      audio.current?.pause();
      return;
    }
    const a = (audio.current ??= new Audio(TAKE.audio));
    const at = tRef.current / 1000;
    if (at >= AUDIO_END) return;
    if (Math.abs(a.currentTime - at) > 0.3) a.currentTime = at;
    a.play().catch(() => setSound(false));
    return () => a.pause();
  }, [playing, sound, started]);
  const { Scene } = CHAPTERS[ch];
  // The phrase she's saying right now (the first one on the poster).
  const cue = started ? Math.max(0, CAPS.findLastIndex(([at]) => t >= at * 1000)) : 0;

  return (
    <div className={`tp${playing ? " is-playing" : ""}`} ref={box}>
      <div className="tp-stage">
        <div className="tp-scene" key={ch}>
          <Scene lt={lt} dur={DUR[ch]} />
        </div>
        <div className="tp-capbox" aria-live="off">
          {cc && (
            <p className="tp-cap" key={cue}>
              {CAPS[cue][1]}
            </p>
          )}
        </div>
        {!playing && (
          <div className={`tp-big${started ? " is-paused" : ""}`}>
            <button className="tp-big-go" onClick={() => start(started ? sound : true)} aria-label={done ? "Replay the tour" : "Play the tour"}>
              <span aria-hidden>{done ? "↺" : "▶"}</span>
              {done ? "Watch again" : started ? "Resume" : `Watch with sound · ${mmss(TOTAL)}`}
            </button>
            {!started && (
              <button className="tp-big-mute" onClick={() => start(false)}>
                or watch muted
              </button>
            )}
          </div>
        )}
      </div>

      <input
        className="tp-scrub"
        type="range"
        min={0}
        max={TOTAL}
        step={100}
        value={t}
        onChange={(e) => seek(Number(e.target.value))}
        style={{ ["--p" as string]: `${(t / TOTAL) * 100}%` }}
        aria-label="Seek"
        aria-valuetext={`${mmss(t)} of ${mmss(TOTAL)}`}
      />
      <div className="tp-bar">
        <button className="tp-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : done ? "↺" : "▶"}
        </button>
        <nav className="tp-tabs" aria-label="Tour chapters">
          {CHAPTERS.map((c, i) => (
            <button key={c.tab} onClick={() => jump(i)} aria-current={started && i === ch ? "step" : undefined}>
              {c.tab}
            </button>
          ))}
        </nav>
        <button className="tp-sound" onClick={toggleCc} aria-pressed={cc} aria-label={cc ? "Hide captions" : "Show captions"}>
          CC
        </button>
        <button className="tp-sound" onClick={() => setSound((v) => !v)} aria-pressed={sound} aria-label={sound ? "Mute" : "Turn sound on"}>
          {sound ? "Sound on" : "Muted"}
        </button>
        <span className="tp-time num">
          {mmss(t)} / {mmss(TOTAL)}
        </span>
      </div>
    </div>
  );
}

/** true once the chapter clock passes `ms`. */
const on = (lt: number, ms: number) => (lt >= ms ? " on" : "");

/* ── Scenes ── */

// The board, calls, how-sure bar, email and search are the real app on live data
// (see TourLive); the drawn versions below stand in on phones or when data isn't there yet.
function Board({ lt, dur }: SceneProps) {
  return <ExampleBoard lt={lt} dur={dur} fallback={<BoardDrawn lt={lt} />} />;
}
/** The three calls, then (on "Each one shows you how confident…") the how-sure bar. Fixed examples, same format every time. */
function Calls({ lt }: SceneProps) {
  const sure = beat("sure");
  const at = [beat("cw"), beat("cl"), beat("cs")];
  if (lt < sure) return <ExampleCalls lt={lt} at={at} fallback={<CallsDrawn lt={lt} at={at} />} />;
  const t = lt - sure;
  return <ExampleSure lt={t} fallback={<SureDrawn lt={t} />} />;
}
function Hedge({ lt }: SceneProps) {
  return <HedgeMontage lt={lt} />;
}
function Daily({ lt, dur }: SceneProps) {
  return <LiveDaily lt={lt} dur={dur} at={beat("mail")} fallback={<DailyDrawn lt={lt} />} />;
}

function Hello({ lt }: { lt: number }) {
  return (
    <div className="ts-end">
      <small className={`ts-note${on(lt, 200)}`}>Welcome to</small>
      <strong className={`ts-end-word${on(lt, 500)}`}>HedgePredict</strong>
      <p className={`ts-hello${on(lt, 1400)}`}>Your prediction market assistant.</p>
    </div>
  );
}

/** The price as the odds: each side lights up with its chance as she reads it. */
function Prices({ lt }: SceneProps) {
  return (
    <div className="ts-card ts-market">
      <span className="ts-k">Polymarket</span>
      <b className="ts-q">Will Kentucky beat South Carolina?</b>
      <div className="ts-prices">
        <div className={`ts-price${on(lt, beat("pct"))}`}>
          <small>Kentucky</small>
          <strong>43¢</strong>
          <em className={`ts-note${on(lt, beat("pct") + 700)}`}>≈ 43% chance</em>
        </div>
        <div className={`ts-price${on(lt, beat("pct2"))}`}>
          <small>South Carolina</small>
          <strong>58¢</strong>
          <em className={`ts-note${on(lt, beat("pct2") + 700)}`}>≈ 58% chance</em>
        </div>
      </div>
    </div>
  );
}

/** The switch flips on "every price turns into…"; the note follows it on screen only. */
function Odds({ lt }: SceneProps) {
  const us = lt >= beat("us");
  const sides = [
    { k: "Kentucky", c: "43¢", a: "+133" },
    { k: "South Carolina", c: "58¢", a: "-138" },
  ];
  return (
    <div className="ts-card ts-odds">
      <div className="ts-odds-top">
        <span className="ts-k">Kentucky vs. South Carolina</span>
        <span className="ts-switch" aria-hidden>
          <i className={us ? "" : "is-on"}>¢</i>
          <i className={us ? "is-on" : ""}>US</i>
        </span>
      </div>
      <div className="ts-prices">
        {sides.map((x, i) => (
          <div key={x.k} className={`ts-price${i ? " is-dim" : ""}`}>
            <small>{x.k}</small>
            <strong className="ts-flip">
              <span className={us ? "is-out" : ""}>{x.c}</span>
              <span className={us ? "" : "is-out"}>{x.a}</span>
            </strong>
          </div>
        ))}
      </div>
      <p className={`ts-pay${on(lt, beat("us") + 1600)}`}>Sportsbook lines can differ a little. Use it as a guide.</p>
    </div>
  );
}

const ROWS: { q: string; call: "Wager" | "Lean" | "Skip"; px: string }[] = [
  { q: "Kentucky vs. South Carolina", call: "Wager", px: "43¢" },
  { q: "Yankees vs. Rays", call: "Skip", px: "55¢" },
  { q: "Bitcoin above $90k on Friday?", call: "Lean", px: "31¢" },
  { q: "Fed cuts rates in December?", call: "Skip", px: "62¢" },
  { q: "Chiefs vs. Raiders", call: "Lean", px: "66¢" },
];

function BoardDrawn({ lt }: { lt: number }) {
  return (
    <div className="ts-board">
      {ROWS.map((r, i) => (
        <div key={r.q} className={`ts-row${on(lt, 200 + i * 220)}`}>
          <span className="ts-row-q">{r.q}</span>
          <span className={`ts-call is-${r.call.toLowerCase()}${on(lt, 2200 + i * 380)}`}>{r.call}</span>
          <span className="ts-row-px num">{r.px}</span>
        </div>
      ))}
    </div>
  );
}

function CallsDrawn({ lt, at }: { lt: number; at: number[] }) {
  const calls = [
    { w: "Wager", m: "HedgePredict likes Kentucky at this price.", c: "wager" },
    { w: "Lean", m: "Bitcoin looks a little cheap. A softer recommendation.", c: "lean" },
    { w: "Skip", m: "Priced about right. No recommendation.", c: "skip" },
  ];
  return (
    <div className="ts-calls">
      {calls.map((x, i) => (
        <div key={x.w} className={`ts-callcol is-${x.c}${on(lt, at[i] - 150)}`}>
          <strong>{x.w}</strong>
          <p>{x.m}</p>
        </div>
      ))}
    </div>
  );
}

function SureDrawn({ lt }: { lt: number }) {
  const k = Math.min(1, Math.max(0, (lt - 500) / 1800));
  const n = Math.round(66 * (1 - Math.pow(1 - k, 3)));
  return (
    <div className="ts-card ts-sure">
      <span className="ts-k">Kentucky vs. South Carolina</span>
      <strong className="ts-call-big is-wager">Wager</strong>
      <p className="ts-sure-line">
        <b className="num">{n}%</b> sure Kentucky is too cheap
      </p>
      <span className="ts-bar" aria-hidden>
        <i style={{ transform: `scaleX(${n / 100})` }} />
      </span>
    </div>
  );
}

/* Hedge Lab mini demo: one panel that builds up as she talks. One example slip, worked out honestly:
   Bet 1: $50 on Kentucky at 40¢ → +$75.00 / −$50.00.   Bet 2: $30 on No (December cut) at 55¢ → +$24.55 / −$30.00.
   Unhedged, the four ways it lands: +$99.55 (22%), +$45.00 (18%), −$25.45 (33%), −$80.00 (27%).
   Lock bet 1 with $62.50 on South Carolina at 50¢ → +$12.50 either way, so the rows become +$37.05 / −$17.50 / +$37.05 / −$17.50:
   floor −$80.00 → −$17.50, ceiling +$99.55 → +$37.05, and the slip finishes up whenever No wins (55%).
   Size bet 2 at a $500 bankroll if you say 65% vs the 55¢ price: Kelly = (0.65 − 0.55) ÷ 0.45 = 22%, half = $55.56. */
const MONTAGE_ROWS = [
  { k: "Kentucky", r: "No", p: "22%", open: 99.55, locked: 37.05 },
  { k: "Kentucky", r: "Yes", p: "18%", open: 45, locked: -17.5 },
  { k: "S. Carolina", r: "No", p: "33%", open: -25.45, locked: 37.05 },
  { k: "S. Carolina", r: "Yes", p: "27%", open: -80, locked: -17.5 },
];

/** Hedge Lab in fifteen seconds: the panel appears, bets drop in, every outcome, lock, size, a thousand runs. Nothing leaves. */
function HedgeMontage({ lt }: { lt: number }) {
  const t = (k: Parameters<typeof beat>[0]) => lt - beat(k);
  const usd = (v: number) => `${v < 0 ? "−" : "+"}$${Math.abs(v).toFixed(2)}`;
  // First the logo and its line fill the screen; on "Drop in the bets" it opens into the Lab panel.
  if (t("drop") < -250) {
    return (
      <div className="ts-lab-hero">
        <div className={`ts-lab-title is-big${on(lt, 150)}`}>
          <HedgeLabMark />
          <b>Hedge Lab</b>
        </div>
        <p className={`ts-lab-motto${on(lt, beat("lab"))}`}>Your personal betting sandbox</p>
      </div>
    );
  }
  const locked = t("lock") > 500;
  const floor = t("map") < 0 ? null : locked ? -17.5 : -80;
  const ceil = t("map") < 0 ? null : locked ? 37.05 : 99.55;
  return (
    <div className="ts-card ts-hedge ts-lab-demo">
      <div className="ts-lab-title is-in">
        <HedgeLabMark />
        <b>Hedge Lab</b>
        <span className="ts-lab-step on">Your personal betting sandbox</span>
      </div>
      <div className="ts-lab-read">
        <div>
          <small>Floor</small>
          <b className={floor == null ? "" : "is-neg"}>{floor == null ? "—" : usd(floor)}</b>
        </div>
        <div>
          <small>Ceiling</small>
          <b className={ceil == null ? "" : "is-pos"}>{ceil == null ? "—" : usd(ceil)}</b>
        </div>
        <div>
          <small>1,000 runs</small>
          <b className={t("sim") > 300 ? "is-pos" : ""}>{t("sim") > 300 ? "Up 55%" : "—"}</b>
          <span className={`ts-lab-spark${on(t("sim"), 0)}`} aria-hidden>
            <i className="is-neg" />
            <i className="is-pos" />
          </span>
        </div>
      </div>
      <div className="ts-lab-body">
      <div className="ts-lab-slip">
        {[
          { q: "Kentucky vs. South Carolina", b: "$50 on Kentucky at 40¢", tag: locked ? "Locked +$12.50" : "" },
          { q: "Fed cuts rates in December?", b: "$30 on No at 55¢", tag: t("size") > 300 ? "Half Kelly: $55.56" : "" },
        ].map((x, i) => (
          <div key={x.q} className={`ts-lab-bet${on(t("drop"), 100 + i * 500)}`}>
            <i>{i + 1}</i>
            <span>{x.q}</span>
            <b>{x.b}</b>
            {x.tag && <em className={i === 0 ? "is-lock" : "is-size"}>{x.tag}</em>}
          </div>
        ))}
      </div>
      <div className="ts-lab-map">
        {MONTAGE_ROWS.map((r, i) => {
          const v = locked ? r.locked : r.open;
          return (
            <div key={i} className={`ts-lab-row${on(t("map"), 150 + i * 200)}`}>
              <span>
                <em className={r.k === "Kentucky" ? "is-pos" : "is-neg"}>{r.k}</em> · <em className={r.r === "No" ? "is-pos" : "is-neg"}>{r.r}</em>
              </span>
              <small>{r.p}</small>
              <b className={v >= 0 ? "is-pos" : "is-neg"}>{usd(v)}</b>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/** The email lands on "Sign up for The Daily". */
function DailyDrawn({ lt }: { lt: number }) {
  const m = beat("mail");
  return (
    <div className={`ts-card ts-mail${on(lt, 150)}`}>
      <div className="ts-mail-head">
        <span className="ts-ava" aria-hidden>H</span>
        <div>
          <b>HedgePredict Daily</b>
          <small>to me · 8:00 AM</small>
        </div>
      </div>
      <b className="ts-mail-subj">Today&apos;s pick: Kentucky at 43¢</b>
      <div className={`ts-mail-pick${on(lt, m + 1300)}`}>
        <span className="ts-call is-wager on">Wager</span>
        <span>Kentucky vs. South Carolina · 66% sure it&apos;s too cheap</span>
      </div>
      <p className={`ts-mail-more${on(lt, m + 2500)}`}>Plus the board, what resolves today, and the biggest movers.</p>
    </div>
  );
}

const FOUND = [
  { q: "Fed cuts rates in December?", px: "62¢" },
  { q: "Fed cuts rates in January?", px: "41¢" },
  { q: "Fed hikes rates in 2027?", px: "9¢" },
];

/** Two beats: the search bar finds any market ("Search all…"), then Ask HedgePredict ("or ask…"). */
function SearchAsk({ lt, dur }: SceneProps) {
  const srch = beat("srch");
  const asked = beat("askhp");
  if (lt < asked) return <LiveSearch lt={lt} dur={dur} at={srch} fallback={<SearchDrawn lt={lt} />} />;
  return <AskChat lt={lt} />;
}

/** Typed while she sets it up; the results land on "Search all of Polymarket". */
function SearchDrawn({ lt }: { lt: number }) {
  const srch = beat("srch");
  const term = "fed rates";
  const typed = term.slice(0, Math.max(0, Math.floor((lt - 500) / 60)));
  return (
    <div className="ts-card ts-search">
      <span className="ts-k">Search all of Polymarket</span>
      <p className="ts-search-bar">{typed || <i className="ts-caret" aria-hidden />}</p>
      {FOUND.map((r, i) => (
        <div key={r.q} className={`ts-row${on(lt, srch + i * 160)}`}>
          <span className="ts-row-q">{r.q}</span>
          <span className="ts-row-px num">{r.px}</span>
        </div>
      ))}
    </div>
  );
}

/** The same example pick the board and calls show (Kentucky at 43¢, 72% sure), so the tour tells one story. */
const live = { question: "Kentucky vs. South Carolina", side: "Kentucky", at: "43¢", label: "Wager", cls: "is-wager", sure: 72 };

function AskChat({ lt }: { lt: number }) {
  const asked = beat("askhp");
  const ask = live ? `What's the call on ${live.question}?` : "What's the call on a December cut?";
  const typed = ask.slice(0, Math.max(0, Math.floor((lt - asked) / 22)));
  return (
    <div className="ts-card ts-chat">
      <span className="ts-k">Ask HedgePredict</span>
      <p className="ts-bub is-you">{typed || " "}</p>
      <p className={`ts-bub is-ai${on(lt, asked + 950)}`}>
        {live ? (
          <>
            <b className={live.cls}>{live.label}.</b> {live.side} looks too cheap at {live.at}. HedgePredict is {live.sure}% sure of that price.
          </>
        ) : (
          <>
            <b className="is-skip">Skip.</b> At 62¢ the price looks about right. HedgePredict is 61% sure it&apos;s fair, so there&apos;s no edge to chase here.
          </>
        )}
      </p>
    </div>
  );
}

const MCP_LINK = "hedgepredict.co/api/mcp";

/**
 * The link pastes in on "connect HedgePredict", the apps it works in appear on
 * "any AI tool", the box lights again on "Paste one link", then the chat on "then just ask".
 */
function Ai({ lt }: { lt: number }) {
  const conn = beat("conn");
  const asked = beat("ask");
  if (lt < asked) {
    const pasted = lt >= conn;
    const lit = pasted && (lt < conn + 900 || (lt >= beat("paste") && lt < beat("paste") + 900));
    return (
      <div className="ts-card ts-connect">
        <span className="ts-k">Connect your AI</span>
        <p className={`ts-connect-url${lit ? " is-pasted" : ""}`}>
          {pasted ? MCP_LINK : <i className="ts-caret" aria-hidden />}
        </p>
        <p className={`ts-connect-ok${on(lt, conn + 700)}`}>Connected to HedgePredict</p>
        <p className={`ts-pay${on(lt, beat("apps"))}`}>Works in Claude · ChatGPT · Cursor · Gemini · any MCP app</p>
      </div>
    );
  }
  const ask = "Any good plays tonight?";
  const typed = ask.slice(0, Math.max(0, Math.floor((lt - asked) / 24)));
  return (
    <div className="ts-card ts-chat">
      <span className="ts-k">Connect your AI</span>
      <p className="ts-bub is-you">{typed || " "}</p>
      <p className={`ts-bub is-ai${on(lt, asked + 650)}`}>
        {live ? (
          <>
            HedgePredict&apos;s top pick today:{" "}
            <b className={live.cls}>
              {live.side} at {live.at} ({live.label}).
            </b>{" "}
            It&apos;s {live.sure}% sure that price is too cheap.
          </>
        ) : (
          <>
            HedgePredict&apos;s recommendation: <b className="is-wager">Kentucky at 43¢ (Wager).</b> It&apos;s 66% sure that price is too cheap. Everything else on tonight&apos;s board looks priced
            about right.
          </>
        )}
      </p>
    </div>
  );
}

function End({ lt }: { lt: number }) {
  return (
    <div className="ts-end">
      <strong className={`ts-end-word${on(lt, 200)}`}>HedgePredict</strong>
      <p className={`ts-end-3${on(lt, 1000)}`}>
        <span className="is-wager">Wager.</span> <span className="is-lean">Lean.</span> <span className="is-skip">Skip.</span>
      </p>
      <small className={`ts-note${on(lt, 2200)}`}>Decision support, not financial advice. We never place trades.</small>
    </div>
  );
}
