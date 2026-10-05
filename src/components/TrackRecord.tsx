"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RecordCall, RecordLine, TrackRecord } from "@/lib/trackRecord";
import { MARKET_TZ } from "@/lib/format";

/**
 * The public scorecard: did HedgePredict call it right before the event? Every Wager and Lean made
 * before a game started (or on a market that isn't a game), graded when it resolves, losses
 * included: a summary, the running profit at a flat $1 a call, the same numbers split by call, by
 * how sure we were and by kind of market, then the full list. Calls made during a live game are
 * shown in their own section and never counted. Until enough calls have resolved it says so.
 */

/** Below this many resolved calls the numbers are noise, and the page says so. */
const ENOUGH = 50;

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const cents = (x: number) => `${Math.max(1, Math.min(99, Math.round(x * 100)))}¢`;
const money = (x: number, digits = 2) => `${x < 0 ? "−" : x > 0 ? "+" : ""}$${Math.abs(x).toFixed(digits)}`;
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.005 ? "" : x > 0 ? " is-pos" : " is-neg");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: MARKET_TZ, month: "short", day: "numeric" });

export function TrackRecordView({ record }: { record: TrackRecord }) {
  const { all } = record;
  const early = all.resolved < ENOUGH;
  return (
    <div className="tr">
      <header className="tr-head">
        <h1>Track record</h1>
        <p>
          Did HedgePredict call it right before the event? Every Wager and Lean made before a game starts is logged the moment it appears, at the price showing
          then, and graded when the market resolves. Losses stay on the page.
        </p>
      </header>

      {early && (
        <p className="tr-early">
          <b>Early days.</b> {all.resolved} {all.resolved === 1 ? "call has" : "calls have"} resolved so far. That is too few to judge the model either way,
          so read this as a running log, not a result. It will mean something at around {ENOUGH}.
        </p>
      )}

      <dl className="tr-tiles">
        <Tile label="Calls logged" value={String(all.logged)} note={record.since ? `since ${day(record.since)}` : ""} />
        <Tile label="Resolved" value={String(all.resolved)} note={`${all.won} won · ${all.lost} lost`} />
        <Tile label="Hit rate" value={pct(all.hitRate)} note={all.breakEven == null ? "" : `needs ${pct(all.breakEven)} to break even`} />
        <Tile label="Return per $1" value={all.perDollar == null ? "—" : money(all.perDollar)} note="flat $1 on every call" tone={tone(all.perDollar)} />
      </dl>

      <section className="tr-sec">
        <h2>Running profit</h2>
        <p className="tr-sub">A flat $1 on every resolved call, added up in the order the calls were made.</p>
        {record.curve.length >= 2 ? <ReturnChart curve={record.curve} /> : <p className="tr-none">The chart appears once two calls have resolved.</p>}
        {record.topWins && record.topWins.sum > Math.abs(all.profit) * 0.5 && (
          <p className="tr-caveat">
            <b>Read this with care.</b> The two biggest wins ({record.topWins.names.join(" and ")}) brought in {money(record.topWins.sum)} between them. Without
            those two results the total would be {money(record.topWins.without)}. A total that depends this much on two results hasn&apos;t proved anything
            yet.
          </p>
        )}
      </section>

      <section className="tr-sec">
        <h2>By call</h2>
        <p className="tr-sub">A Wager is our strongest call. A Lean is a mild tilt.</p>
        <Lines rows={record.byCall} />
      </section>

      <section className="tr-sec">
        <h2>By how sure we were</h2>
        <p className="tr-sub">If the model is any good, the calls it was surer about should do better.</p>
        <Lines rows={record.bySure} />
      </section>

      <section className="tr-sec">
        <h2>By kind of market</h2>
        <p className="tr-sub">Games resolve in hours. Futures and elections can stay open for months, so few of those have been graded yet.</p>
        <Lines rows={record.byTiming} />
      </section>

      <section className="tr-sec tr-live">
        <h2>
          In-game calls <small>not part of the record</small>
        </h2>
        <p className="tr-sub">
          HedgePredict also makes calls while a game is being played. Prices swing hard mid-game, a team at 5¢ can be a &quot;call&quot;, and the model can end up
          on both teams in the same game. That says little about whether it read the market right beforehand, so these are kept here and counted nowhere
          above.
        </p>
        <Lines rows={[record.live.all, ...record.live.byCall]} />
      </section>

      <section className="tr-sec">
        <h2>Every call</h2>
        <p className="tr-sub">
          Newest first. Calls marked &quot;in-game&quot; were made during a live game and aren&apos;t in the record.
          {record.earlyCount > 0 ? ` The ${record.earlyCount} marked "earlier" were made before the switch to Polymarket US and aren't counted either.` : ""}
        </p>
        <Calls calls={record.calls} />
      </section>

      <section className="tr-sec tr-how">
        <h2>How this is kept</h2>
        <ul>
          <li>A call is logged once, the first time it shows on the board, with the price of the side we called at that moment. It is never edited afterward.</li>
          <li>The record counts calls made before a game started, and calls on markets that aren&apos;t games. A call first made after kickoff goes in the in-game section instead.</li>
          <li>No call is logged after its market has ended.</li>
          <li>Profit assumes $1 on the called side at the logged price: a win pays $1 a share, a loss is the full $1. Fees and price slippage are not included.</li>
          <li>A market that settles with no clear winner is marked void and counts as zero.</li>
          <li>The hit rate means little on its own. A side bought at 70¢ has to win about 70% of the time just to break even, which is why the break-even rate sits next to it.</li>
        </ul>
        <p className="tr-disc">
          Past results don&apos;t predict future ones. This is decision support, not financial advice, and HedgePredict never places trades. Only risk what you can
          afford to lose.
        </p>
      </section>
    </div>
  );
}

function Tile({ label, value, note, tone: t = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="tr-tile">
      <dt>{label}</dt>
      <dd className={`num${t}`}>{value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

function Lines({ rows }: { rows: RecordLine[] }) {
  return (
    <div className="tr-scroll">
      <table className="tr-table">
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col">Logged</th>
            <th scope="col">Resolved</th>
            <th scope="col">Won · lost</th>
            <th scope="col">Hit rate</th>
            <th scope="col">Break-even</th>
            <th scope="col">Return per $1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="num">{r.logged}</td>
              <td className="num">{r.resolved}</td>
              <td className="num">{r.resolved ? `${r.won} · ${r.lost}` : "—"}</td>
              <td className="num">{pct(r.hitRate)}</td>
              <td className="num">{pct(r.breakEven)}</td>
              <td className={`num${tone(r.perDollar)}`}>{r.perDollar == null ? "—" : money(r.perDollar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RESULT = { open: "Open", won: "Won", lost: "Lost", void: "Void" } as const;

function Calls({ calls }: { calls: RecordCall[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? calls : calls.slice(0, 40);
  return (
    <>
      <div className="tr-scroll">
        <table className="tr-table tr-calls">
          <thead>
            <tr>
              <th scope="col">Logged</th>
              <th scope="col">Market</th>
              <th scope="col">Call</th>
              <th scope="col">Price</th>
              <th scope="col">How sure</th>
              <th scope="col">Result</th>
              <th scope="col">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.early || c.timing === "live" ? "is-early" : undefined}>
                <td className="num">{day(c.loggedAt)}</td>
                <td className="tr-q">
                  {c.question}
                  {c.early ? <small>earlier</small> : c.timing === "live" ? <small>in-game</small> : null}
                </td>
                <td>
                  <span className={c.call === "Wager" ? "tr-wager" : "tr-lean"}>{c.call}</span> {c.side}
                </td>
                <td className="num">{cents(c.sidePrice)}</td>
                <td className="num">{pct(c.howSure)}</td>
                <td className={c.result === "won" ? "is-pos" : c.result === "lost" ? "is-neg" : "tr-open"}>{RESULT[c.result]}</td>
                <td className={`num${tone(c.result === "open" ? null : c.profit)}`}>{c.result === "open" || c.profit == null ? "—" : money(c.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {calls.length > 40 && (
        <button className="hp-showall tr-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Show fewer ▴" : `Show all ${calls.length} calls ▾`}
        </button>
      )}
    </>
  );
}

/* ── The running-profit chart ── */

const H = 240;
const PAD = { l: 52, r: 68, t: 16, b: 28 };

/** A step that gives about four clean gridlines for a range. */
function niceStep(range: number) {
  const raw = range / 4 || 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function ReturnChart({ curve }: { curve: TrackRecord["curve"] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const n = curve.length;
    const vs = curve.map((p) => p.v);
    const step = niceStep(Math.max(...vs, 0) - Math.min(...vs, 0));
    const lo = Math.floor(Math.min(...vs, 0) / step) * step;
    const hi = Math.ceil(Math.max(...vs, 0) / step) * step || step;
    // One even step per call: the origin ($0, before any call) sits at the left edge.
    const x = (i: number) => PAD.l + ((i + 1) / n) * (w - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v / step) * step);
    const pts = curve.map((p, i) => ({ ...p, n: i + 1, x: x(i), y: y(p.v) }));
    return { pts, ticks, y, path: `M${PAD.l} ${y(0)}` + pts.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") };
  }, [curve, w]);

  const last = g.pts[g.pts.length - 1];
  const cur = at == null ? null : g.pts[at];
  // The crosshair finds the nearest resolved call by x, so the pointer only has to be close.
  const nearest = (clientX: number) => {
    const left = box.current?.getBoundingClientRect().left ?? 0;
    const px = clientX - left;
    let best = 0;
    g.pts.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(g.pts[best].x - px)) best = i;
    });
    return best;
  };
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { timeZone: MARKET_TZ, month: "short", day: "numeric" });

  return (
    <div
      className="tr-chart"
      ref={box}
      tabIndex={0}
      role="img"
      aria-label={`Running profit at $1 a call: ${money(last.v)} after ${g.pts.length} resolved calls. The same figures are in the tables below.`}
      onPointerMove={(e) => setAt(nearest(e.clientX))}
      onPointerLeave={() => setAt(null)}
      onFocus={() => setAt((i) => i ?? g.pts.length - 1)}
      onBlur={() => setAt(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setAt((i) => Math.max(0, (i ?? g.pts.length - 1) - 1));
        if (e.key === "ArrowRight") setAt((i) => Math.min(g.pts.length - 1, (i ?? 0) + 1));
      }}
    >
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden>
        {g.ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "tr-zero" : "tr-grid"} x1={PAD.l} x2={w - PAD.r} y1={g.y(v)} y2={g.y(v)} />
            <text className="tr-tick" x={PAD.l - 10} y={g.y(v)} textAnchor="end" dominantBaseline="middle">
              {v === 0 ? "$0" : money(v, Math.abs(v) < 1 ? 2 : 0)}
            </text>
          </g>
        ))}
        <text className="tr-tick" x={PAD.l} y={H - 8}>First call, {fmt(g.pts[0].t)}</text>
        <text className="tr-tick" x={w - PAD.r} y={H - 8} textAnchor="end">Call {g.pts.length}, {fmt(last.t)}</text>
        <path className="tr-line" d={g.path} />
        {cur && <line className="tr-cross" x1={cur.x} x2={cur.x} y1={PAD.t} y2={H - PAD.b} />}
        <circle className="tr-dot" cx={(cur ?? last).x} cy={(cur ?? last).y} r={4.5} />
        {!cur && (
          <text className="tr-endlabel" x={last.x + 10} y={last.y} dominantBaseline="middle">
            {money(last.v)}
          </text>
        )}
      </svg>
      {cur && (
        <div className="tr-tip" style={{ left: Math.min(Math.max(cur.x, 110), w - 110), top: Math.max(8, cur.y - 14) }}>
          <b className={`num${tone(cur.v)}`}>{money(cur.v)}</b>
          <span>
            Call {cur.n} · {fmt(cur.t)} · {cur.call} {cur.side} {cur.won ? "won" : "lost"} ({money(cur.profit)})
          </span>
          <small>{cur.question}</small>
        </div>
      )}
    </div>
  );
}
