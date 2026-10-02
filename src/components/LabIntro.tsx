"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeHedge } from "@/lib/scoring";

/**
 * Hedge Lab's opening: a ~4 second scale animation that shows what a hedge does,
 * then stays as the page's header (final frame). Plays once per visit; Skip and
 * Replay are always there; reduced motion goes straight to the end. The numbers
 * come from analyzeHedge(), the same math as the calculator below.
 */
const EX = { stake: 100, bought: 0.43, now: 0.6 };
const h = analyzeHedge({ stakeA: EX.stake, priceA: EX.bought, priceB: 1 - EX.now });
const usd = (n: number) => `$${n.toFixed(2)}`;
const c = (p: number) => `${Math.round(p * 100)}¢`;

const STEPS = [
  { at: 0, title: <>You bought Yes at {c(EX.bought)}.</>, sub: <>{usd(EX.stake)} on Yes. If No wins, it&apos;s gone.</> },
  { at: 1300, title: <>Then Yes climbed to {c(EX.now)}.</>, sub: <>Good news, but nothing is locked in yet.</> },
  { at: 2600, title: <>Buy No at {c(1 - EX.now)}.</>, sub: <>{usd(h.hedgeStakeB)} on the other side, sized to match your shares.</> },
  { at: 3900, title: <>+{usd(h.floor)} either way.</>, sub: <>Yes wins or No wins, you keep the same profit. That&apos;s the lock.</> },
];
const LAST = STEPS.length - 1;
const KEY = "hp_lab_intro_seen";

export function LabIntro() {
  // null until we know whether to play (avoids a flash of step 0 for repeat visits).
  const [step, setStep] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const play = useCallback(() => {
    clear();
    setStep(0);
    STEPS.slice(1).forEach((s, i) => timers.current.push(window.setTimeout(() => setStep(i + 1), s.at)));
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* plays again next visit */
    }
  }, []);
  const skip = () => {
    clear();
    setStep(LAST);
  };

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* treat as first visit */
    }
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => (seen || still ? setStep(LAST) : play()), 0);
    return () => {
      clearTimeout(t);
      clear();
    };
  }, [play]);

  const s = step ?? LAST;
  const done = step === LAST;
  // Left pan heavy until the hedge lands, then the beam levels out.
  const tilt = s < 2 ? -13 : 0;

  return (
    <section className={`lab-intro${step === null ? " is-pending" : ""}${done ? " is-done" : ""}`} aria-label="How a hedge works">
      <div className="lab-copy" aria-live="polite">
        <span className="lab-k">How a hedge works · example</span>
        <h2 key={`t${s}`} className="lab-title">{STEPS[s].title}</h2>
        <p key={`s${s}`} className="lab-sub">{STEPS[s].sub}</p>
        <dl className="lab-out" aria-hidden={!done}>
          <div><dt>If Yes wins</dt><dd>+{usd(h.profitIfWin)}</dd></div>
          <div><dt>If No wins</dt><dd>+{usd(h.profitIfLose)}</dd></div>
        </dl>
        <button className="lab-ctl" onClick={done ? play : skip}>{done ? "Replay ↺" : "Skip"}</button>
      </div>

      <div className="lab-stage" aria-hidden>
        <div className="lab-scale" style={{ ["--tilt" as string]: `${tilt}deg` }}>
          <span className="lab-post" />
          <span className="lab-base" />
          <div className="lab-beam">
            <span className="lab-pivot" />
            <Pan side="l" k="Yes" lines={[`${usd(EX.stake)} at ${c(EX.bought)}`, s >= 1 ? `now ${c(EX.now)}` : ""]} on />
            <Pan side="r" k="No" lines={[`${usd(h.hedgeStakeB)} at ${c(1 - EX.now)}`, ""]} on={s >= 2} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pan({ side, k, lines, on }: { side: "l" | "r"; k: string; lines: [string, string]; on: boolean }) {
  return (
    <div className={`lab-pan is-${side}${on ? " is-on" : ""}`}>
      <span className="lab-string" />
      <div className="lab-card">
        <b>{k}</b>
        <span>{lines[0]}</span>
        <small className={lines[1] ? "is-in" : ""}>{lines[1] || " "}</small>
      </div>
    </div>
  );
}
