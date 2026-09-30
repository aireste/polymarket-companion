"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Odometer text: each digit rolls to its new value, and the whole value flashes
 * lime (up) or coral (down) when `flash` changes. Non-digits render as-is.
 */
export function Odo({ value, flash }: { value: string; flash?: { dir: 1 | -1; at: number } }) {
  const [cls, setCls] = useState("");
  const last = useRef(flash?.at);

  useEffect(() => {
    if (!flash || flash.at === last.current) return;
    last.current = flash.at;
    setCls("");
    const r = requestAnimationFrame(() => setCls(flash.dir > 0 ? "hp-flash-up" : "hp-flash-dn"));
    return () => cancelAnimationFrame(r);
  }, [flash]);

  return (
    <span className={`hp-odo ${cls}`} aria-label={value}>
      {[...value].map((c, i) =>
        /\d/.test(c) ? (
          <span className="hp-odo-d" key={i} aria-hidden>
            <span style={{ transform: `translateY(-${Number(c)}em)` }}>
              {"0123456789".split("").map((n) => (
                <i key={n}>{n}</i>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden>
            {c}
          </span>
        )
      )}
    </span>
  );
}
