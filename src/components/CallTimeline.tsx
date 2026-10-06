"use client";

import { Fragment, useEffect, useState } from "react";
import type { CallChangeDTO, PlayDTO } from "@/lib/dto";
import { useBoard } from "@/lib/boardStore";
import { price, MARKET_TZ } from "@/lib/format";
import { useOddsFormat } from "@/lib/oddsFormat";
import { shortSide } from "@/lib/jevDisplay";

const WORD: Record<CallChangeDTO["action"], string> = { wager: "Wager", hold: "Lean", skip: "Skip", decided: "Decided" };

function ago(iso: string, now: number) {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: MARKET_TZ, weekday: "short", hour: "numeric", minute: "2-digit" });

/** The call as of this moment, in the same shape as a stored change. */
function currentOf(read: ReturnType<typeof useBoard>["reads"][string] | undefined): Pick<CallChangeDTO, "action" | "side"> | null {
  if (!read) return null;
  if (read.settled) return { action: "decided", side: null };
  if (read.lean == null || read.action === "skip") return { action: "skip", side: null };
  return { action: read.action, side: read.sides[read.lean]?.label ?? null };
}

/**
 * How this market's call moved, in one quiet line under the call:
 * "Earlier: Lean Falcons at 46¢ · 19h ago → Wager Falcons at 47¢ · 3h ago → now Skip".
 * Shows nothing until the call has actually changed. "See all" lists every step.
 */
export function CallTimeline({ play, variant }: { play: PlayDTO; variant: "desk" | "phone" }) {
  const fmt = useOddsFormat();
  const { reads, now } = useBoard();
  const cur = currentOf(reads[play.id]);
  const curKey = cur ? `${cur.action}:${cur.side ?? ""}` : "";
  const [hist, setHist] = useState<{ id: string; changes: CallChangeDTO[] } | null>(null);
  const [open, setOpen] = useState(false);

  // Fetch per market; again when the live call changes (the server records the new step).
  useEffect(() => {
    let alive = true;
    fetch(`/api/jev/history?id=${encodeURIComponent(play.id)}`)
      .then((r) => r.json())
      .then((d: { changes?: CallChangeDTO[] }) => alive && setHist({ id: play.id, changes: d.changes ?? [] }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [play.id, curKey]);

  if (!cur || !hist || hist.id !== play.id) return null;
  // Earlier steps = stored history minus a trailing row that matches what's showing now.
  const steps = [...hist.changes];
  const last = steps[steps.length - 1];
  if (last && last.action === cur.action && (last.side ?? "") === (cur.side ?? "")) steps.pop();
  if (!steps.length) return null;

  const label = (c: Pick<CallChangeDTO, "action" | "side">) =>
    c.side ? `${WORD[c.action]} ${shortSide(c.side, 16)}` : WORD[c.action];
  const at = (c: CallChangeDTO) => (c.price == null ? "" : ` at ${price(c.price, fmt)}`);
  const shown = steps.slice(-2);

  return (
    <div className={`hp-ct is-${variant}`}>
      <p className="hp-ct-line">
        <span className="hp-ct-k">Earlier:</span>{" "}
        {steps.length > shown.length && <span className="hp-ct-more">…{" "}</span>}
        {shown.map((c, i) => (
          <Fragment key={c.at}>
            {i > 0 && <span className="hp-ct-arrow"> → </span>}
            <span className={`hp-ct-call is-${c.action}`}>{label(c)}</span>
            <span className="hp-ct-at">
              {at(c)} · {ago(c.at, now)}
            </span>
          </Fragment>
        ))}
        <span className="hp-ct-arrow"> → </span>
        <span className="hp-ct-at">now </span>
        <span className={`hp-ct-call is-${cur.action}`}>{label(cur)}</span>
      </p>
      <button className="hp-ct-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide history" : `See all ${steps.length + 1} calls`}
      </button>
      {open && (
        <ol className="hp-ct-list">
          {steps.map((c) => (
            <li key={c.at}>
              <span className="hp-ct-time">{when(c.at)}</span>
              <span className={`hp-ct-call is-${c.action}`}>{label(c)}</span>
              <span className="hp-ct-at">{c.price == null ? "" : price(c.price, fmt)}</span>
            </li>
          ))}
          <li>
            <span className="hp-ct-time">Now</span>
            <span className={`hp-ct-call is-${cur.action}`}>{label(cur)}</span>
            <span className="hp-ct-at" />
          </li>
        </ol>
      )}
    </div>
  );
}
