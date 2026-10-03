"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/**
 * Walking into Hedge Lab. Once per visit (per browser tab) a lemon shutter slams down over the
 * whole screen (one sharp shake as it lands), "Hedge Lab" rises in letter by letter with the flask
 * and the motto, and the shutter lifts to the Lab. Coming back in the same visit, just the Lab's
 * panels rising in. Transform/opacity only; skipped for reduced motion; any click or key skips it.
 * Loading `/hedge?intro` directly replays it.
 */

const KEY = "hp_lab_entered";
/** How long the intro runs before it unmounts (ms), matching its CSS. */
const RUNTIME = 2150;
const MOTTO = "Test it before you bet it.";
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
  const playing = mode === "intro" && !done;

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
    if (!playing) return;
    const end = () => setDone(true);
    const timer = setTimeout(end, RUNTIME);
    window.addEventListener("keydown", end);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", end);
    };
  }, [playing]);

  if (!mode) return null;
  if (!playing) return <span className="lab-entry-mark" hidden />;

  // Rendered on <body>: above the top nav, and clear of the page's own fade (a transformed or
  // animating ancestor would re-anchor a fixed layer) and the app's 4px corner rounding.
  return createPortal(
    <div className="lab-entry" aria-hidden onClick={() => setDone(true)}>
      <div className="le-id">
        <div className="le-name">
          <b className="le-word">
            {"Hedge Lab".split("").map((ch, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </b>
          <svg className="le-flask" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M9.5 3h5M10 3v6.2L5.2 17.6A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.4L14 9.2V3" strokeLinecap="round" strokeLinejoin="round" />
            <path className="le-spark" d="M12 12.2l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <p className="le-motto">{MOTTO}</p>
      </div>
    </div>,
    document.body
  );
}
