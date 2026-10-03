"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/**
 * Walking into Hedge Lab. Once per visit (per browser tab) a lemon shutter slams down over the
 * whole screen (one sharp shake as it lands), "Hedge Lab" rises in letter by letter, the motto
 * follows once the name is in and holds long enough to read, and the shutter lifts to the Lab.
 * Coming back in the same visit, just the Lab's panels rising in. Transform/opacity only; skipped
 * for reduced motion; any click or key skips it. Loading `/hedge?intro` directly replays it.
 */

const KEY = "hp_lab_entered";
/** How long the intro runs before it unmounts (ms), matching its CSS. */
const RUNTIME = 3600;
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
        <b className="le-word">
          {"Hedge Lab".split("").map((ch, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              {ch === " " ? "\u00a0" : ch}
            </span>
          ))}
        </b>
        <p className="le-motto">{MOTTO}</p>
      </div>
    </div>,
    document.body
  );
}
