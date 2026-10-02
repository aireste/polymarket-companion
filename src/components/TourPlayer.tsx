"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The How it works tour: a ~48s "video" drawn in code (real type, real colors,
 * light/dark aware). Nothing moves until someone presses play; it pauses when
 * scrolled away and rests on the last frame when done. Each chapter is one idea
 * and one caption. Scenes read `lt` (ms into the chapter) and flip classes at
 * beats; CSS transitions do the motion.
 */
const CH = 6000;

const CHAPTERS: { tab: string; caption: string; Scene: (p: { lt: number }) => ReactNode }[] = [
  { tab: "Prices", caption: "A price is the crowd's odds. 43¢ means about a 43% chance, and a winning share pays $1.", Scene: Prices },
  { tab: "The board", caption: "HedgePredict reads every market on the board and checks whether the price looks too cheap.", Scene: Board },
  { tab: "Calls", caption: "Every market gets one of three calls. The color tells you what to do.", Scene: Calls },
  { tab: "How sure", caption: "Each call says how sure it is, so you know how hard to lean on it.", Scene: Sure },
  { tab: "Hedge Lab", caption: "Already holding a bet? Hedge Lab shows how to lock in a result either way.", Scene: Hedge },
  { tab: "The Daily", caption: "The Daily sends the day's best pick to your inbox, weekday mornings.", Scene: Daily },
  { tab: "Your AI", caption: "Use HedgePredict inside Claude or ChatGPT. Just ask in plain English.", Scene: Ai },
  { tab: "That's it", caption: "You make the call. HedgePredict helps you see what the prices say.", Scene: End },
];
const TOTAL = CH * CHAPTERS.length;
const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function TourPlayer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  // The clock: advance only while playing; stop on the last frame.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current == null ? 0 : now - last.current;
      last.current = now;
      setT((cur) => {
        const next = Math.min(TOTAL, cur + dt);
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
    if (t >= TOTAL) setT(0);
    setPlaying((p) => !p || t >= TOTAL);
  }, [t]);
  const jump = (i: number) => {
    setStarted(true);
    setT(i * CH);
    setPlaying(true);
  };

  const done = t >= TOTAL;
  // Before the first play, show chapter 1 fully drawn as the poster.
  const ch = started ? Math.min(CHAPTERS.length - 1, Math.floor(t / CH)) : 0;
  const lt = started ? (done ? CH : t - ch * CH) : CH;
  const { Scene, caption } = CHAPTERS[ch];

  return (
    <div className={`tp${playing ? " is-playing" : ""}`} ref={box}>
      <div className="tp-stage">
        <div className="tp-scene" key={ch}>
          <Scene lt={lt} />
        </div>
        <p className="tp-cap" key={`c${ch}`}>{caption}</p>
        {!playing && (
          <button className="tp-big" onClick={toggle} aria-label={done ? "Replay the tour" : "Play the tour"}>
            <span aria-hidden>{done ? "↺" : "▶"}</span>
            {done ? "Watch again" : started ? "Resume" : `Watch the tour · ${mmss(TOTAL)}`}
          </button>
        )}
      </div>

      <div className="tp-bar">
        <span className="tp-prog" style={{ transform: `scaleX(${t / TOTAL})` }} aria-hidden />
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

function Prices({ lt }: { lt: number }) {
  return (
    <div className="ts-card ts-market">
      <span className="ts-k">Polymarket · College football</span>
      <b className="ts-q">Will Kentucky beat South Carolina?</b>
      <div className="ts-prices">
        <div className={`ts-price${on(lt, 900)}`}>
          <small>Kentucky</small>
          <strong>43¢</strong>
          <em className={`ts-note${on(lt, 1800)}`}>≈ 43% chance</em>
        </div>
        <div className="ts-price is-dim">
          <small>South Carolina</small>
          <strong>58¢</strong>
        </div>
      </div>
      <p className={`ts-pay${on(lt, 3000)}`}>
        Buy a Kentucky share for 43¢ <span>→</span> it pays <b>$1.00</b> if Kentucky wins.
      </p>
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

function Board({ lt }: { lt: number }) {
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

function Calls({ lt }: { lt: number }) {
  const calls = [
    { w: "Wager", m: "We like Kentucky at this price.", c: "wager" },
    { w: "Lean", m: "Bitcoin looks a little cheap. Not a strong play.", c: "lean" },
    { w: "Skip", m: "Priced fair. Sit this one out.", c: "skip" },
  ];
  return (
    <div className="ts-calls">
      {calls.map((x, i) => (
        <div key={x.w} className={`ts-callcol is-${x.c}${on(lt, 300 + i * 900)}`}>
          <strong>{x.w}</strong>
          <p>{x.m}</p>
        </div>
      ))}
    </div>
  );
}

function Sure({ lt }: { lt: number }) {
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
      <p className={`ts-conf${on(lt, 2800)}`}>Medium confidence</p>
    </div>
  );
}

function Hedge({ lt }: { lt: number }) {
  const locked = lt >= 2600;
  const outs = [
    { k: "If Yes wins", before: 75, after: 12.5 },
    { k: "If No wins", before: -50, after: 12.5 },
  ];
  return (
    <div className="ts-card ts-hedge">
      <span className="ts-k ts-lab">Hedge Lab</span>
      <p className="ts-hedge-head">
        You hold <b>$50 on Yes at 40¢</b>.{" "}
        <span className={`ts-note${on(lt, 1400)}`}>
          Put <b>$62.50 on No</b> at 50¢:
        </span>
      </p>
      {outs.map((o) => {
        const v = locked ? o.after : o.before;
        return (
          <div key={o.k} className="ts-out">
            <small>{o.k}</small>
            <span className="ts-out-track" aria-hidden>
              <i className={v < 0 ? "is-neg" : ""} style={{ width: `${(Math.abs(v) / 75) * 50}%`, [v < 0 ? "right" : "left"]: "50%" }} />
            </span>
            <b className={`num${v < 0 ? " is-neg" : ""}`}>{`${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(2)}`}</b>
          </div>
        );
      })}
      <p className={`ts-locked${on(lt, 3000)}`}>Locked: +$12.50 either way.</p>
    </div>
  );
}

function Daily({ lt }: { lt: number }) {
  return (
    <div className={`ts-card ts-mail${on(lt, 300)}`}>
      <div className="ts-mail-head">
        <span className="ts-ava" aria-hidden>H</span>
        <div>
          <b>HedgePredict Daily</b>
          <small>to me · 8:00 AM</small>
        </div>
      </div>
      <b className="ts-mail-subj">Today&apos;s pick: Back Kentucky at 43¢</b>
      <div className={`ts-mail-pick${on(lt, 1600)}`}>
        <span className="ts-call is-wager on">Wager</span>
        <span>Kentucky vs. South Carolina · 66% sure it&apos;s too cheap</span>
      </div>
      <p className={`ts-mail-more${on(lt, 2800)}`}>Plus the board, what resolves today, and the biggest movers.</p>
    </div>
  );
}

function Ai({ lt }: { lt: number }) {
  const ask = "Any good plays tonight?";
  const typed = ask.slice(0, Math.max(0, Math.floor((lt - 300) / 45)));
  return (
    <div className="ts-card ts-chat">
      <span className="ts-k">Claude · HedgePredict connected</span>
      <p className="ts-bub is-you">{typed || " "}</p>
      <p className={`ts-bub is-ai${on(lt, 2400)}`}>
        <b className="is-wager">Back Kentucky at 43¢.</b> HedgePredict is 66% sure it&apos;s too cheap. Everything else on tonight&apos;s board looks priced about
        right.
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
