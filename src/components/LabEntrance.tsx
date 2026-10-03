"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Walking into Hedge Lab. Once per visit (per browser tab): the screen drops to black, the flask
 * draws itself in lemon, a hairline strikes across and bursts into a lemon screen (one sharp
 * shake), the name holds for a beat, then the lemon lifts away like a shutter. Coming back to the
 * Lab in the same visit, just its panels rising in. Transform/opacity only; skipped for reduced
 * motion; any click or key skips it. `/hedge?intro` replays the full intro.
 */

const KEY = "hp_lab_entered";
type Mode = "intro" | "switch" | null;

// Decided once per visit to the page (a stable snapshot), reset when the page unmounts.
let decided: Mode | undefined;
function decide(): Mode {
  if (decided !== undefined) return decided;
  let seen = false;
  try {
    seen = sessionStorage.getItem(KEY) === "1";
  } catch {
    /* storage blocked: treat as seen, no intro */
    seen = true;
  }
  const force = new URLSearchParams(window.location.search).has("intro");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  decided = reduce ? null : force || !seen ? "intro" : "switch";
  return decided;
}
const noSubscribe = () => () => {};

export function LabEntrance() {
  const mode = useSyncExternalStore(noSubscribe, decide, () => null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* fine */
    }
    return () => {
      decided = undefined;
    };
  }, []);

  useEffect(() => {
    if (mode !== "intro" || done) return;
    const skip = () => setDone(true);
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [mode, done]);

  if (!mode) return null;
  if (mode === "switch" || done) return <span className="lab-entry-mark" data-mode="switch" hidden />;

  return (
    <div className="lab-entry" data-mode="intro" aria-hidden onClick={() => setDone(true)}>
      <div className="le-stage">
        <svg className="le-flask" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
          <path pathLength={1} d="M9.5 3h5M10 3v6.2L5.2 17.6A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.4L14 9.2V3" strokeLinecap="round" strokeLinejoin="round" />
          <path className="le-spark" d="M12 12.2l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="currentColor" stroke="none" />
        </svg>
        <b className="le-word">Hedge Lab</b>
      </div>
      <i className="le-line" />
      <div className="le-lift" onAnimationEnd={(e) => e.animationName === "le-lift" && setDone(true)}>
        <div className="le-slab">
          <div className="le-slab-in">
            <b>Hedge Lab</b>
            <span>You&apos;re in the Lab.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
