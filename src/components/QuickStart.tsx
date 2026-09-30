"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "hp_quickstart_done";

/** First-visit guide on the board: three steps, dismissed for good once read. */
export function QuickStart() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;

  const done = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: it just shows again next time */
    }
  };

  return (
    <section className="hp-qs" aria-label="Quick start">
      <div className="hp-qs-head">
        <b>HedgePredict in 30 seconds</b>
        <button className="hp-qs-x" onClick={done} aria-label="Dismiss quick start">
          ✕
        </button>
      </div>
      <ol className="hp-qs-steps">
        <li>
          <span>1</span>
          <div>
            <b>Scan the board</b>
            <p>Live Polymarket markets ranked by signal, each with Jev&apos;s call: wager, hold or skip.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <b>Open a market</b>
            <p>See wager, hold or skip, market vs Jev, and an optional deep read of the live news.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <b>Ask anything</b>
            <p>“Any good Bitcoin plays?” Jev makes the call, Claude explains it.</p>
          </div>
        </li>
      </ol>
      <div className="hp-qs-actions">
        <Link href="/ask" className="pill hp-pill-lime" onClick={done}>
          Ask HedgePredict →
        </Link>
        <button className="pill" onClick={done}>
          Got it
        </button>
        <Link href="/how-it-works" className="hp-qs-more" onClick={done}>
          How it works
        </Link>
      </div>
    </section>
  );
}
