"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CallTimeline } from "./CallTimeline";
import Link from "next/link";
import type { JevReadDTO, PlayDTO } from "@/lib/dto";
import { useBoard, useNow } from "@/lib/boardStore";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useRecommendation } from "@/lib/useRecommendation";
import { useJev } from "@/lib/useJev";
import { useJevExplain } from "@/lib/useJevExplain";
import { JEV_ACTION_COPY, leanSide, shortSide } from "@/lib/jevDisplay";
import { clockLabel, countdownShort, isLive, price, resolveAt, usd, whenMs } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { Recommendation } from "./Recommendation";
import { JevPill } from "./JevPill";
import { Status } from "./Status";
import { Icon } from "./icons";
import { Odo } from "./Odo";
import { SubscribeBox, useJoinedDaily } from "./SubscribeBox";
import { useOddsFormat } from "@/lib/oddsFormat";
import { useMarketStats } from "@/lib/useMarketStats";

const RANGES = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
];

/**
 * Everything about one market: the dark price centerpiece, Jev's call, the
 * optional deep read, and the numbers. Desktop shows it as the right-hand
 * inspector; the phone shows the same thing inside a bottom sheet.
 */
export function Inspector({ play, pass = false }: { play: PlayDTO; pass?: boolean }) {
  const { now } = useBoard();
  return (
    <div className="hp-insp-body" key={play.id}>
      <header className="hp-insp-head">
        <Status play={play} now={now} icon />
        <h2>{play.question}</h2>
      </header>
      {pass && <JevPass play={play} />}
      <PriceCard play={play} />
      <JevVerdict play={play} />
      <DeepRead play={play} />
      <MarketStats play={play} className="hp-stats" />
      <div className="hp-insp-actions">
        <a className="pill pill-dark hp-pm-btn" href={play.url} target="_blank" rel="noopener noreferrer">
          <span className="hp-pm-tile">{Icon.polymarket}</span>
          Open on Polymarket ↗
        </a>
        <Link className="pill" href={`/ask?q=${encodeURIComponent(`What's the call on "${play.question}"?`)}`}>
          <span className="hp-ico-sm">{Icon.ask}</span>
          Ask about this
        </Link>
      </div>
      <p className="hp-disc">
        Decision support, not financial advice. HedgePredict never places trades.
      </p>
    </div>
  );
}

const RANGE_WORD: Record<string, string> = { "1d": "day", "1w": "week", "1m": "month" };
const sinceMin = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

/**
 * The call as the second big number: Wager (green), Lean (amber) or Skip
 * (gray), with the side and how sure underneath. What to do, at a glance.
 */
function CallBig({ play }: { play: PlayDTO }) {
  const { reads, jevStatus } = useBoard();
  const r = reads[play.id];
  if (!r) {
    return (
      <div className="hp-dd-big hp-dd-call is-none">
        <b>{jevStatus === "offline" ? "Off" : "…"}</b>
        <small>{jevStatus === "offline" ? "Calls are offline right now" : "Reading the call"}</small>
      </div>
    );
  }
  if (r.settled) {
    return (
      <div className="hp-dd-big hp-dd-call is-skip">
        <b>Decided</b>
        <small>One side is already at 97% or more</small>
        <CallTimeline play={play} variant="desk" />
      </div>
    );
  }
  const a = JEV_ACTION_COPY[r.action];
  const side = leanSide(r);
  const sure = Math.round(r.strength * 100);
  // One plain sentence on what to do, in the same words How it works uses.
  const meaning =
    r.action === "wager" ? (
      <>
        We like <em>{shortSide(side?.label ?? "", 18)}</em> at this price.
      </>
    ) : r.action === "hold" ? (
      <>
        <em>{shortSide(side?.label ?? "", 18)}</em> looks a little cheap. Not a strong play.
      </>
    ) : (
      <>Priced fair. Sit this one out.</>
    );
  return (
    <div className={`hp-dd-big hp-dd-call is-${a.cls}`}>
      <b>{a.label}</b>
      <span className="hp-dd-mean">{meaning}</span>
      <small>
        {sure}% sure{side ? " it's too cheap" : " both prices are fair"}
      </small>
      <CallTimeline play={play} variant="desk" />
    </div>
  );
}

/**
 * Desktop detail (HP4 "Terminal, time-first"): the price and the countdown as
 * two big numbers, a clean line chart, then the call beside its 100-reads
 * breakdown. Same data and pieces as the phone sheet, laid out for a wide screen.
 */
export function DeskDetail({ play }: { play: PlayDTO }) {
  const fmt = useOddsFormat();
  const now = useNow(1000);
  const target = play.outcomes[0];
  const [range, setRange] = useState("1w");
  const { history, loading, error } = usePriceHistory(target?.tokenId, range);
  const current = target?.price ?? (history?.length ? history[history.length - 1].p : 0);
  const first = history?.length ? history[0].p : current;
  const delta = (current - first) * 100;
  const live = isLive(play.gameStartTime, now);
  const at = play.gameStartTime ?? play.endDate;
  const others = play.outcomes.slice(1, 4);

  return (
    <div className="hp-dd" key={play.id}>
      <TradedLine play={play} />
      <h2 className="hp-dd-q">{play.question}</h2>
      <p className={`hp-dd-when${live ? " is-live" : ""}`}>
        {live
          ? `Live · ${sinceMin(now - whenMs(play))} in`
          : `${play.gameStartTime ? "Starts" : "Resolves"} in ${countdownShort(play, now, true)} · ${resolveAt(at)}`}
      </p>

      <div className="hp-dd-twin">
        <div className="hp-dd-big">
          <b className="num">
            <Odo value={price(current, fmt, "pct")} />
          </b>
          <small>
            {target?.label}
            {history && Math.abs(delta) >= 0.05 && (
              <>
                {" · "}
                <em className={delta >= 0 ? "up" : "dn"}>
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(1)} pts
                </em>{" "}
                past {RANGE_WORD[range]}
              </>
            )}
          </small>
        </div>
        <CallBig play={play} />
      </div>

      <div className="hp-dd-chart">
        {loading && <div className="chart-skl" aria-hidden />}
        {!loading && error && <div className="chart-empty">No price history for this market yet.</div>}
        {!loading && !error && history && <PriceChart points={history} flat />}
      </div>
      <div className="hp-dd-ranges">
        <div role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="hp-dd-side">
          {others.length > 0 && (
            <span className="num">{others.map((o) => `${o.label} ${price(o.price, fmt, "pct")}`).join(" · ")}</span>
          )}
          <a className="hp-dd-pm" href={play.url} target="_blank" rel="noopener noreferrer" aria-label="Open on Polymarket" title="Open on Polymarket">
            <span className="hp-pm-tile">{Icon.polymarket}</span>
          </a>
        </div>
      </div>

      <JevVerdict play={play} />
      <DeepRead play={play} />

      <MarketStats play={play} className="hp-dd-stats" />

      <p className="hp-disc">Decision support, not financial advice. HedgePredict never places trades.</p>
    </div>
  );
}

const spreadText = (s: number | null) => (s == null ? "—" : `${(s * 100).toFixed(1)}¢`);

/** When it resolves, plus how it trades: spread from the board, $ figures looked up on open. */
function MarketStats({ play, className }: { play: PlayDTO; className: string }) {
  const { volume, liquidity } = useMarketStats(play);
  return (
    <dl className={className}>
      <div>
        <dt>{play.gameStartTime ? "Starts" : "Resolves"}</dt>
        <dd>{resolveAt(play.gameStartTime ?? play.endDate)}</dd>
      </div>
      <div>
        <dt>Spread</dt>
        <dd className="num">{spreadText(play.spread)}</dd>
      </div>
      <div>
        <dt>Liquidity</dt>
        <dd className="num">{liquidity == null ? "—" : usd(liquidity)}</dd>
      </div>
      <div>
        <dt>All-time volume</dt>
        <dd className="num">{volume == null ? "—" : usd(volume)}</dd>
      </div>
    </dl>
  );
}

/** The kicker above the question: money traded once it's known, else the spread. */
function TradedLine({ play }: { play: PlayDTO }) {
  const { volume, liquidity } = useMarketStats(play);
  const text =
    volume != null ? `${usd(volume)} traded${liquidity != null ? ` · ${usd(liquidity)} liquidity` : ""}` : play.spread != null ? `${spreadText(play.spread)} spread` : "";
  return <p className="hp-dk">{text || "\u00a0"}</p>;
}

function PriceCard({ play }: { play: PlayDTO }) {
  const fmt = useOddsFormat();
  const target = play.outcomes[0];
  const [range, setRange] = useState("1w");
  const { history, loading, error } = usePriceHistory(target?.tokenId, range);
  // The big number is the live price (polled every 20s); history is for the line.
  const current = target?.price ?? (history?.length ? history[history.length - 1].p : 0);
  const first = history?.length ? history[0].p : current;
  const delta = (current - first) * 100;
  const others = play.outcomes.slice(1, 4);

  return (
    <section className="featured hp-price" aria-label="Price">
      <div className="featured-top">
        <div className="featured-num">
          <span className="featured-pct num"><Odo value={price(current, fmt, "pct")} /></span>
          <span className="featured-outcome">{target?.label}</span>
        </div>
        <div className="range" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              className={`range-btn${range === r.id ? " active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {history && (
        <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts over {range.toUpperCase()}
        </span>
      )}
      <div className="featured-chart">
        {loading && <div className="chart-skl" aria-hidden />}
        {!loading && error && <div className="chart-empty">No price history for this market yet.</div>}
        {!loading && !error && history && <PriceChart points={history} flat />}
      </div>
      <div className="featured-foot">
        <span className="featured-meta num">
          {others.map((o) => `${o.label} ${price(o.price, fmt, "pct")}`).join(" · ")}
        </span>
      </div>
    </section>
  );
}

/** Jev's call. Board markets arrive pre-read; anything else is one tap away. */
function JevVerdict({ play }: { play: PlayDTO }) {
  const fmt = useOddsFormat();
  const { reads, jevStatus, setRead } = useBoard();
  const shown = useMounted();
  const manual = useJev(play.id);
  const read = reads[play.id] ?? manual.jev;
  const explain = useJevExplain(read ?? null);

  useEffect(() => {
    if (manual.jev) setRead(manual.jev);
  }, [manual.jev, setRead]);

  if (!read) {
    if (jevStatus === "loading" || manual.loading) {
      return (
        <div className="hp-verdict hp-verdict-wait">
          <span className="rec-spinner" aria-hidden /> Reading the numbers…
        </div>
      );
    }
    if (jevStatus === "offline" || manual.error === "no-key") {
      return <div className="hp-verdict hp-verdict-wait">Calls are offline right now. Try again in a bit.</div>;
    }
    return (
      <div className="hp-verdict hp-verdict-ask">
        <div>
          <div className="hp-verdict-k">HedgePredict</div>
          <div className="hp-verdict-lead">What&apos;s the call?</div>
          {manual.error && <p className="helper">Couldn&apos;t get the call. Try again.</p>}
        </div>
        <button className="pill hp-pill-lime" onClick={manual.run}>
          Get the call →
        </button>
      </div>
    );
  }

  if (read.settled) {
    return (
      <section className="hp-verdict" aria-label="HedgePredict's call">
        <span className="hp-verdict-k">HedgePredict&apos;s call</span>
        <div className="hp-verdict-call">Effectively decided.</div>
        <div className="hp-verdict-sub">One side is already at 97% or more, so there&apos;s nothing left to call.</div>
      </section>
    );
  }
  const side = leanSide(read);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const headline =
    read.action === "wager" ? `Back ${side?.label}.` : read.action === "hold" ? `Leans ${side?.label}.` : "Priced about right.";

  return (
    <section className="hp-verdict" aria-label="HedgePredict's call">
      {/* The headline already names the call and the side, so the header doesn't repeat it; confidence sits under the headline. */}
      <div className="hp-verdict-row">
        <span className="hp-verdict-k">HedgePredict&apos;s call</span>
      </div>
      <div className="hp-verdict-call">{headline}</div>
      <div className="hp-verdict-sub">
        {!side
          ? `${pct(read.strength)} sure both prices are fair.`
          : `${pct(read.strength)} sure ${side.label} is too cheap at ${price(side.price, fmt)}.`}
      </div>
      {/* The one thing people misread: the % is HedgePredict's confidence, not a chance of winning (that's the price). */}
      <p className="hp-verdict-note">
        {side
          ? `That's HedgePredict's confidence, not the chance ${side.label} wins (the market says ${pct(side.price)}).`
          : "That's HedgePredict's confidence, not a chance to win."}
      </p>
      <LeanBar read={read} shown={shown} />

      {!explain.explanation && explain.error !== "no-key" && (
        <button className="hp-link" onClick={explain.run} disabled={explain.loading}>
          {explain.loading ? "Explaining…" : "Why this call?"}
        </button>
      )}
      {explain.error && explain.error !== "no-key" && (
        <p className="helper">
          {explain.error}{" "}
          <button className="linklike" onClick={explain.run}>
            Try again
          </button>
        </p>
      )}
      {explain.explanation && (
        <div className="hp-explain">
          <p>{explain.explanation}</p>
          {explain.model && <span>{explain.model}</span>}
        </div>
      )}
    </section>
  );
}

/** The slower Claude + live-news read. Optional, and only after Jev has spoken. */
function DeepRead({ play }: { play: PlayDTO }) {
  const { rec, loading, error, run } = useRecommendation(play.id);
  const joined = useJoinedDaily();
  if (error === "no-key") return null;
  // Lead gen: deep reads are free for Daily readers. (A browser-side gate; the
  // server's 3-per-day limit still protects cost either way.)
  if (!joined && !rec) {
    return (
      <div className="hp-deep-lock">
        <SubscribeBox
          compact
          source="deep-read-unlock"
          title="Unlock deep reads"
          blurb="We check the live news behind any market in about 15 seconds. Free for HedgePredict Daily readers: join and it unlocks right away."
        />
      </div>
    );
  }
  const limited = error?.startsWith("You've used today's") ?? false;
  if (rec) return <Recommendation rec={rec} url={play.url} />;
  if (loading) {
    return (
      <div className="rec-loading">
        <span className="rec-spinner" aria-hidden />
        Reading live news &amp; sentiment… about 15 seconds.
      </div>
    );
  }
  return (
    <div className="hp-deep">
      <div>
        <div className="hp-deep-lead">Want the story behind the numbers?</div>
        <div className="hp-deep-sub">Checks live news and what people are saying (about 15 seconds). 3 per day.</div>
        {error && (
          <p className="helper" style={{ color: limited ? "var(--ink-soft)" : "var(--neg-ink)" }}>
            {error}
          </p>
        )}
      </div>
      {!limited && (
        <button className="pill" onClick={run}>
          {error ? "Try again" : "Deep read"}
        </button>
      )}
    </div>
  );
}

/** True one frame after mount, so bars and markers animate in from zero. */
function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return on;
}

/**
 * Jev's answer as one stacked bar: each side's share of "this side is
 * underpriced" with "priced about right" in the middle. The leaned side is lit.
 */
/**
 * Natural-frequency version of the bar, which people read more easily than
 * percentages: "If Jev read this market 100 times, it would call Yes a
 * bargain 45 times, the price fair 53 times, and No a bargain 2 times."
 */
export function LeanBar({ read, shown, compact = false }: { read: JevReadDTO; shown: boolean; compact?: boolean }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // Three colors, always: the side we'd back (green), the other side (amber: how
  // torn the read is), fair price (gray). On a skip, "the side we'd back" is the bigger share.
  const top = read.lean ?? read.distribution.sides.reduce((best, p, i, all) => (p > all[best] ? i : best), 0);
  const segs = read.sides.map((s, i) => ({ key: `s${i}`, label: `${s.label} is a bargain`, p: read.distribution.sides[i] ?? 0, lean: read.lean === i, kind: i === top ? "is-top" : "is-alt" }));
  const neither = { key: "n", label: "Fair price", p: read.distribution.neither, lean: read.lean == null, kind: "is-n" };
  // Two-sided markets read left side / neither / right side; others put neither last.
  const order = segs.length === 2 ? [segs[0], neither, segs[1]] : [...segs, neither];
  const tone = read.action === "wager" ? "wager" : read.action === "hold" ? "hold" : "skip";
  return (
    <div className={`hp-lean ${tone}`} aria-label="How the call splits">
      {!compact && <div className="hp-lean-q">Is either side a bargain at these prices?</div>}
      <div className="hp-lean-bar">
        {order.map((g) => (
          <i
            key={g.key}
            className={`${g.kind} ${g.lean ? `is-lean ${tone}` : ""}`}
            style={{ flexGrow: shown ? Math.max(g.p, 0.015) : 1 }}
          />
        ))}
      </div>
      <LeanLabels order={order} pct={pct} />
    </div>
  );
}

/**
 * Each label sits under its own color: the first at the bar's left edge, the last at its right edge, the
 * middle centered under its segment. Long labels wrap to two short lines, and a label slides within its own
 * segment to make room; only when there's no room at all does it drop to a second line.
 */
function LeanLabels({ order, pct }: { order: { key: string; label: string; p: number; lean: boolean; kind: string }[]; pct: (x: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const sig = order.map((g) => `${g.key}:${g.p}:${g.label}`).join("|");
  const [lefts, setLefts] = useState<number[] | null>(null);
  const [tops, setTops] = useState<number[]>([]);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const W = el.clientWidth;
      const spans = [...el.children] as HTMLElement[];
      const w = spans.map((x) => x.offsetWidth);
      const lh = Math.max(...spans.map((x) => x.offsetHeight));
      const grow = order.map((g) => Math.max(g.p, 0.015));
      const total = grow.reduce((a, b) => a + b, 0);
      const GAP = 3, PAD = 14, room = W - GAP * (order.length - 1);
      let acc = 0;
      // Each segment's span, and where its label wants to be: the first at the bar's left edge,
      // the last at its right edge, the middle centered under its segment.
      const seg = grow.map((g) => {
        const start = (acc / total) * room;
        acc += g;
        return { start, end: (acc / total) * room };
      }).map((sg, i) => ({ start: sg.start + i * GAP, end: sg.end + i * GAP }));
      const want = seg.map((sg, i) =>
        i === 0 ? 0 : i === order.length - 1 ? W - w[i] : (sg.start + sg.end) / 2 - w[i] / 2
      );
      // Fit left to right: each label stays as close to its spot as it can, sliding within its own
      // segment (or the bar's edge) to clear its neighbors. If that's not enough, labels may slide
      // past their segment (order kept); only if even that fails does the smallest drop a line.
      const n = order.length;
      const lo = seg.map((sg, i) => Math.max(0, Math.min(sg.start, W - w[i])));
      const hi = seg.map((sg, i) => Math.max(lo[i], Math.min(sg.end - w[i], W - w[i])));
      const barLo = w.map(() => 0), barHi = w.map((wi) => Math.max(0, W - wi));
      const fit = (idx: number[], lo: number[], hi: number[]) => {
        const x = idx.map((i) => Math.min(hi[i], Math.max(lo[i], want[i])));
        for (let k = 1; k < idx.length; k++) x[k] = Math.min(hi[idx[k]], Math.max(x[k], x[k - 1] + w[idx[k - 1]] + PAD));
        for (let k = idx.length - 2; k >= 0; k--) x[k] = Math.max(lo[idx[k]], Math.min(x[k], x[k + 1] - w[idx[k]] - PAD));
        const ok = x.every((v, k) => k === 0 || v >= x[k - 1] + w[idx[k - 1]] + PAD - 0.5);
        return { x, ok };
      };
      const all = [...Array(n).keys()];
      let main = all, below: number[] = [];
      let f = fit(main, lo, hi);
      if (!f.ok) f = fit(main, barLo, barHi);
      if (!f.ok) {
        const smallest = all.reduce((m, i) => (grow[i] < grow[m] ? i : m), 0);
        main = all.filter((i) => i !== smallest);
        below = [smallest];
        f = fit(main, lo, hi);
      }
      const pos: { x: number; r: number }[] = [];
      main.forEach((i, k) => (pos[i] = { x: f.x[k], r: 0 }));
      below.forEach((i) => (pos[i] = { x: Math.min(hi[i], Math.max(lo[i], want[i])), r: 1 }));
      const rows = below.length ? [0, 1] : [0];
      setLefts(pos.map((p) => p.x));
      setTops(pos.map((p) => p.r * (lh + 6)));
      setH(rows.length * lh + (rows.length - 1) * 6);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
    // `order` is rebuilt every render; re-place only when its numbers or labels actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (
    <div className="hp-lean-lbls" ref={box} style={{ height: h || undefined }}>
      {order.map((g, i) => (
        <span key={g.key} className={`${g.kind}${g.lean ? " is-lean" : ""}`} style={{ left: lefts?.[i] ?? 0, top: tops[i] ?? 0, visibility: lefts ? "visible" : "hidden" }}>
          <b>{pct(g.p)}</b>
          <em>{g.label}</em>
        </span>
      ))}
    </div>
  );
}

/** Phone sheet header, boarding-pass style: the side at its market price → Jev's lean. */
export function JevPass({ play }: { play: PlayDTO }) {
  const fmt = useOddsFormat();
  const { reads } = useBoard();
  const r = reads[play.id];
  if (!r || r.settled) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const side = leanSide(r);
  const [s0, s1] = r.sides;
  const a = JEV_ACTION_COPY[r.action];
  const tone = r.action === "wager" ? "wager" : r.action === "hold" ? "hold" : "skip";
  return (
    <section className="hp-pass" aria-label="HedgePredict's read">
      <div className="hp-pass-top">
        <span className="hp-verdict-k">HedgePredict&apos;s read</span>
        <JevPill id={play.id} />
      </div>
      <div className="hp-pass-prices">
        <div>
          <small>{shortSide(s0.label, 18)}</small>
          <b>{price(s0.price, fmt)}</b>
        </div>
        {s1 && (
          <div>
            <small>{shortSide(s1.label, 18)}</small>
            <b>{price(s1.price, fmt)}</b>
          </div>
        )}
      </div>
      <p className={`hp-pass-verdict ${tone}`}>
        {r.action === "wager"
          ? `We like ${shortSide(side?.label ?? "", 22)} at this price.`
          : r.action === "hold"
            ? `${shortSide(side?.label ?? "", 22)} looks a little cheap. Not a strong play.`
            : "Priced fair. Sit this one out."}
        <span> · {pct(r.strength)} sure</span>
      </p>
      <LeanBar read={r} shown compact />
      <CallTimeline play={play} variant="phone" />
      <div className="hp-pass-foot">
        <span>
          Call<b>{side ? `${a.label} ${shortSide(side.label, 12)}` : "Skip"}</b>
        </span>
        <span>
          Confidence<b>{r.confidence == null ? "–" : pct(r.confidence)}</b>
        </span>
        <span>
          Resolves<b>{clockLabel(play)}</b>
        </span>
      </div>
    </section>
  );
}
