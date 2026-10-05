"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TrackRecord } from "@/lib/trackRecord";
import { buildRecord, type CallFilter, type CurvePoint, type RecordCall, type RecordLine } from "@/lib/recordMath";
import { MARKET_TZ } from "@/lib/format";

/**
 * The public scorecard: did HedgePredict call it right before the event? Every Wager and Lean made
 * before a game started (or on a market that isn't a game), graded when it resolves, losses
 * included. A filter narrows the whole page to Wagers or Leans. Then: a summary, the running
 * profit at a flat $1 a call, each call's result, hit rate against break-even by price paid, the
 * same numbers in tables, and the full list. Calls made during a live game are shown in their own
 * section and never counted. Until enough calls have resolved it says so plainly.
 */

/** Below this many resolved calls the numbers are noise, and the page says so. */
const ENOUGH = 50;

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const cents = (x: number) => `${Math.max(1, Math.min(99, Math.round(x * 100)))}¢`;
const money = (x: number, digits = 2) => `${x < 0 ? "−" : x > 0 ? "+" : ""}$${Math.abs(x).toFixed(digits)}`;
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.005 ? "" : x > 0 ? " is-pos" : " is-neg");
const day = (iso: string | number) => new Date(iso).toLocaleDateString("en-US", { timeZone: MARKET_TZ, month: "short", day: "numeric" });

const FILTERS: { id: CallFilter; label: string }[] = [
  { id: "all", label: "All calls" },
  { id: "Wager", label: "Wagers" },
  { id: "Lean", label: "Leans" },
];

export function TrackRecordView({ record }: { record: TrackRecord }) {
  const [filter, setFilter] = useState<CallFilter>("all");
  const view = useMemo(() => buildRecord(record.calls, filter), [record.calls, filter]);
  const { all } = view;
  const early = all.resolved < ENOUGH;
  const what = filter === "all" ? "call" : filter;
  return (
    <div className="tr">
      <header className="tr-head">
        <h1>Track record</h1>
        <p>
          Did HedgePredict call it right before the event? Every Wager and Lean made before a game starts is logged the moment it appears, at the price showing
          then, and graded when the market resolves. Losses stay on the page.
        </p>
      </header>

      <div className="tr-filter" role="tablist" aria-label="Which calls to show">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {early && (
        <p className="tr-early">
          <b>Early days.</b> {all.resolved} {all.resolved === 1 ? `${what} has` : `${what}s have`} resolved so far. That is too few to judge the model either
          way, so read this as a running log, not a result. It will mean something at around {ENOUGH}.
        </p>
      )}

      <dl className="tr-tiles">
        <Tile label="Calls logged" value={String(all.logged)} note={view.since ? `since ${day(view.since)}` : ""} />
        <Tile label="Resolved" value={String(all.resolved)} note={`${all.won} won · ${all.lost} lost`} />
        <Tile label="Hit rate" value={pct(all.hitRate)} note={all.breakEven == null ? "" : `needs ${pct(all.breakEven)} to break even`} />
        <Tile label="Return per $1" value={all.perDollar == null ? "—" : money(all.perDollar)} note="flat $1 on every call" tone={tone(all.perDollar)} />
      </dl>

      <section className="tr-sec">
        <h2>Running profit</h2>
        <p className="tr-sub">A flat $1 on every resolved call, added up in the order the calls were made.</p>
        {view.curve.length >= 2 ? <ReturnChart curve={view.curve} /> : <p className="tr-none">This chart appears once two calls have resolved.</p>}
        {view.topWins && view.topWins.sum > Math.abs(all.profit) * 0.5 && (
          <p className="tr-caveat">
            <b>Read this with care.</b> The two biggest wins ({view.topWins.names.join(" and ")}) brought in {money(view.topWins.sum)} between them. Without
            those two results the total would be {money(view.topWins.without)}. A total that depends this much on two results hasn&apos;t proved anything
            yet.
          </p>
        )}
      </section>

      <section className="tr-sec">
        <h2>Each call&apos;s result</h2>
        <p className="tr-sub">
          One bar per resolved call, in the order they were made. A win pays more the cheaper the side was, so a few tall bars can outweigh several losses.
        </p>
        {view.curve.length >= 1 ? <ResultBars curve={view.curve} /> : <p className="tr-none">This chart appears once a call has resolved.</p>}
      </section>

      <section className="tr-sec">
        <h2>Hit rate by price paid</h2>
        <p className="tr-sub">
          A side bought at 30¢ only has to win about 30% of the time to break even. If the bar reaches past the marker, calls at that price have been winning
          more often than they needed to.
        </p>
        {all.resolved >= 1 ? <PriceBands rows={view.byPrice} /> : <p className="tr-none">This chart appears once a call has resolved.</p>}
      </section>

      {filter === "all" && (
        <section className="tr-sec">
          <h2>By call</h2>
          <p className="tr-sub">A Wager is our strongest call. A Lean is a mild tilt.</p>
          <Lines rows={view.byCall} />
        </section>
      )}

      <section className="tr-sec">
        <h2>By how sure we were</h2>
        <p className="tr-sub">If the model is any good, the calls it was surer about should do better.</p>
        <Lines rows={view.bySure} />
      </section>

      <section className="tr-sec">
        <h2>By kind of market</h2>
        <p className="tr-sub">Games resolve in hours. Futures and elections can stay open for months, so few of those have been graded yet.</p>
        <Lines rows={view.byTiming} />
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
        <Lines rows={filter === "all" ? [view.live.all, ...view.live.byCall] : [view.live.all]} />
      </section>

      <section className="tr-sec">
        <h2>Every call</h2>
        <p className="tr-sub">
          Newest first. Calls marked &quot;in-game&quot; were made during a live game and aren&apos;t in the record.
          {view.earlyCount > 0 ? ` The ${view.earlyCount} marked "earlier" were made before the switch to Polymarket US and aren't counted either.` : ""}
        </p>
        <Calls key={filter} calls={view.calls} />
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

/* ── Charts ── */

const PAD = { l: 52, r: 68, t: 16, b: 28 };

/** A step that gives about four clean gridlines for a range. */
function niceStep(range: number) {
  const raw = range / 4 || 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** A dollar scale that always includes $0, with clean ticks. */
function dollarScale(values: number[], top: number, bottom: number) {
  const step = niceStep(Math.max(...values, 0) - Math.min(...values, 0));
  const lo = Math.floor(Math.min(...values, 0) / step) * step;
  const hi = Math.ceil(Math.max(...values, 0) / step) * step || step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, y: (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bottom - top) };
}
const tickLabel = (v: number) => (v === 0 ? "$0" : money(v, Math.abs(v) < 1 ? 2 : 0));

/** The chart's box, measured, so its text stays the same size at any width. */
function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, w };
}

/** The hover/focus readout: value first, then what it is. */
function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  return (
    <div className="tr-tip" style={{ left: Math.min(Math.max(x, 112), w - 112), top: Math.max(8, y - 12) }}>
      {children}
    </div>
  );
}

/** Pointer and keyboard both walk the marks: the nearest one by x, or arrow keys once focused. */
function useWalk(xs: number[], box: React.RefObject<HTMLDivElement | null>) {
  const [at, setAt] = useState<number | null>(null);
  const n = xs.length;
  return {
    at: at != null && at < n ? at : null,
    bind: {
      tabIndex: 0,
      onPointerMove: (e: React.PointerEvent) => {
        const px = e.clientX - (box.current?.getBoundingClientRect().left ?? 0);
        let best = 0;
        xs.forEach((x, i) => {
          if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = i;
        });
        setAt(best);
      },
      onPointerLeave: () => setAt(null),
      onFocus: () => setAt((i) => i ?? n - 1),
      onBlur: () => setAt(null),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "ArrowLeft") setAt((i) => Math.max(0, (i ?? n - 1) - 1));
        if (e.key === "ArrowRight") setAt((i) => Math.min(n - 1, (i ?? 0) + 1));
      },
    },
  };
}

function CallTip({ p, lead }: { p: CurvePoint; lead: number }) {
  return (
    <>
      <b className={`num${tone(lead)}`}>{money(lead)}</b>
      <span>
        Call {p.n} · {day(p.t)} · {p.call} {p.side} at {cents(p.price)} {p.won ? "won" : "lost"}
      </span>
      <small>{p.question}</small>
    </>
  );
}

/** Running profit: one 2px line, hairline grid, a firmer zero line, the latest value labeled at the end. */
function ReturnChart({ curve }: { curve: CurvePoint[] }) {
  const H = 240;
  const { box, w } = useWidth();
  const g = useMemo(() => {
    const s = dollarScale(curve.map((p) => p.v), PAD.t, H - PAD.b);
    // One even step per call: the origin ($0, before any call) sits at the left edge.
    const pts = curve.map((p, i) => ({ p, x: PAD.l + ((i + 1) / curve.length) * (w - PAD.l - PAD.r), y: s.y(p.v) }));
    return { ...s, pts, path: `M${PAD.l} ${s.y(0)}` + pts.map((q) => `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join("") };
  }, [curve, w]);
  const walk = useWalk(g.pts.map((q) => q.x), box);
  const last = g.pts[g.pts.length - 1];
  const cur = walk.at == null ? null : g.pts[walk.at];
  return (
    <div className="tr-chart" ref={box} role="img" aria-label={`Running profit at $1 a call: ${money(last.p.v)} after ${g.pts.length} resolved calls. The same figures are in the tables below.`} {...walk.bind}>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden>
        {g.ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "tr-zero" : "tr-grid"} x1={PAD.l} x2={w - PAD.r} y1={g.y(v)} y2={g.y(v)} />
            <text className="tr-tick" x={PAD.l - 10} y={g.y(v)} textAnchor="end" dominantBaseline="middle">{tickLabel(v)}</text>
          </g>
        ))}
        <text className="tr-tick" x={PAD.l} y={H - 8}>First call, {day(g.pts[0].p.t)}</text>
        <text className="tr-tick" x={w - PAD.r} y={H - 8} textAnchor="end">Call {g.pts.length}, {day(last.p.t)}</text>
        <path className="tr-line" d={g.path} />
        {cur && <line className="tr-cross" x1={cur.x} x2={cur.x} y1={PAD.t} y2={H - PAD.b} />}
        <circle className="tr-dot" cx={(cur ?? last).x} cy={(cur ?? last).y} r={4.5} />
        {!cur && <text className="tr-endlabel" x={last.x + 10} y={last.y} dominantBaseline="middle">{money(last.p.v)}</text>}
      </svg>
      {cur && (
        <Tip x={cur.x} y={cur.y} w={w}>
          <CallTip p={cur.p} lead={cur.p.v} />
        </Tip>
      )}
    </div>
  );
}

/** Each call's own result: a bar up from $0 for a win, down for a loss. Green and red mean profit and loss here, nothing else. */
function ResultBars({ curve }: { curve: CurvePoint[] }) {
  const H = 220;
  const { box, w } = useWidth();
  const g = useMemo(() => {
    const s = dollarScale(curve.map((p) => p.profit), PAD.t, H - PAD.b);
    const slot = (w - PAD.l - PAD.r) / curve.length;
    // Thin marks: at most 24px, and never the whole slot, so neighbors keep a gap.
    const bw = Math.max(2, Math.min(24, slot - 2));
    const bars = curve.map((p, i) => ({ p, x: PAD.l + slot * (i + 0.5), top: Math.min(s.y(p.profit), s.y(0)), h: Math.max(1, Math.abs(s.y(p.profit) - s.y(0))) }));
    return { ...s, bars, bw };
  }, [curve, w]);
  const walk = useWalk(g.bars.map((b) => b.x), box);
  const cur = walk.at == null ? null : g.bars[walk.at];
  const won = curve.filter((p) => p.won).length;
  return (
    <div className="tr-chart" ref={box} role="img" aria-label={`Each resolved call's profit at $1: ${won} won and ${curve.length - won} lost. Every call is listed in the table below.`} {...walk.bind}>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden>
        {g.ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "tr-zero" : "tr-grid"} x1={PAD.l} x2={w - PAD.r} y1={g.y(v)} y2={g.y(v)} />
            <text className="tr-tick" x={PAD.l - 10} y={g.y(v)} textAnchor="end" dominantBaseline="middle">{tickLabel(v)}</text>
          </g>
        ))}
        {g.bars.map((b, i) => (
          <rect key={b.p.n} className={`${b.p.won ? "tr-bar-pos" : "tr-bar-neg"}${cur && walk.at !== i ? " is-dim" : ""}`} x={b.x - g.bw / 2} y={b.top} width={g.bw} height={b.h} rx={Math.min(2, g.bw / 2)} />
        ))}
        <text className="tr-tick" x={PAD.l} y={H - 8}>First call</text>
        <text className="tr-tick" x={w - PAD.r} y={H - 8} textAnchor="end">Call {curve.length}</text>
      </svg>
      <p className="tr-legend">
        <span><i className="tr-key tr-key-pos" /> Won</span>
        <span><i className="tr-key tr-key-neg" /> Lost</span>
      </p>
      {cur && (
        <Tip x={cur.x} y={cur.top} w={w}>
          <CallTip p={cur.p} lead={cur.p.profit} />
        </Tip>
      )}
    </div>
  );
}

/** Hit rate against break-even, by price paid: a bar for how often calls won, a marker for how often they had to. */
function PriceBands({ rows }: { rows: RecordLine[] }) {
  const H = 232;
  const P = { l: 52, r: 20, t: 22, b: 46 };
  const { box, w } = useWidth();
  const slot = (w - P.l - P.r) / rows.length;
  const bw = Math.min(24, slot * 0.4);
  const y = (v: number) => P.t + (1 - v) * (H - P.t - P.b);
  const xs = rows.map((_, i) => P.l + slot * (i + 0.5));
  const walk = useWalk(xs, box);
  const cur = walk.at == null ? null : rows[walk.at];
  return (
    <div className="tr-chart" ref={box} role="img" aria-label="Hit rate and break-even rate by price paid. The same figures follow in the tables below." {...walk.bind}>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className={v === 0 ? "tr-zero" : "tr-grid"} x1={P.l} x2={w - P.r} y1={y(v)} y2={y(v)} />
            <text className="tr-tick" x={P.l - 10} y={y(v)} textAnchor="end" dominantBaseline="middle">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.label} className={cur && walk.at !== i ? "is-dim" : undefined}>
            {r.hitRate != null && (
              <>
                <rect className="tr-bar" x={xs[i] - bw / 2} y={y(r.hitRate)} width={bw} height={Math.max(1, y(0) - y(r.hitRate))} rx={2} />
                <text className="tr-barlabel" x={xs[i]} y={y(r.hitRate) - 7} textAnchor="middle">{pct(r.hitRate)}</text>
                {/* Break-even: a short ink marker across the bar's column, ringed so it reads over the bar. */}
                <line className="tr-mark-ring" x1={xs[i] - bw / 2 - 7} x2={xs[i] + bw / 2 + 7} y1={y(r.breakEven!)} y2={y(r.breakEven!)} />
                <line className="tr-mark" x1={xs[i] - bw / 2 - 7} x2={xs[i] + bw / 2 + 7} y1={y(r.breakEven!)} y2={y(r.breakEven!)} />
              </>
            )}
            <text className="tr-cat" x={xs[i]} y={H - 26} textAnchor="middle">{r.label}</text>
            <text className="tr-tick" x={xs[i]} y={H - 9} textAnchor="middle">{r.resolved ? `${r.resolved} resolved` : "none yet"}</text>
          </g>
        ))}
      </svg>
      <p className="tr-legend">
        <span><i className="tr-key tr-key-bar" /> Hit rate</span>
        <span><i className="tr-key tr-key-mark" /> Break-even (average price paid)</span>
      </p>
      {cur && walk.at != null && (
        <Tip x={xs[walk.at]} y={cur.hitRate == null ? y(0.5) : y(cur.hitRate) - 14} w={w}>
          <b className="num">{cur.hitRate == null ? "No results yet" : `${pct(cur.hitRate)} hit rate`}</b>
          <span>
            {cur.label} · {cur.resolved ? `${cur.won} won, ${cur.lost} lost` : `${cur.logged} logged, none resolved`}
          </span>
          {cur.breakEven != null && <small>Needs {pct(cur.breakEven)} to break even · {money(cur.perDollar ?? 0)} per $1</small>}
        </Tip>
      )}
    </div>
  );
}
