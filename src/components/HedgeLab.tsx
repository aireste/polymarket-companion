"use client";

import { useMemo, useState } from "react";
import { track } from "@/lib/track";
import { useBoard } from "@/lib/boardStore";
import { todaysPick } from "@/lib/pick";
import type { PlayDTO } from "@/lib/dto";
import {
  clampPrice,
  eventPnl,
  events,
  fullLock,
  kelly,
  outcomes,
  scenarios,
  simulate,
  summary,
  worthNow,
  type LabPosition,
  type SimResult,
} from "@/lib/lab";
import { MarketSearch } from "./HedgeCalc";
import { HedgeLabMark } from "./HedgeLabMark";

/**
 * Hedge Lab: a betting sandbox, an app inside the app. Build a slip on the
 * bench, then run it through four instruments: every way it can land, how to
 * lock in what you can, how much a bankroll says to stake, and a thousand
 * simulated runs. Pure math on live prices; nothing here places a bet.
 */

const MAX = 4;
/** Dollars, rounded to the cent first so a break-even never shows as "−$0.00". */
const money = (x: number, sign = false) => {
  const r = Math.round(x * 100) / 100;
  return `${sign && r > 0 ? "+" : r < 0 ? "−" : ""}$${Math.abs(r).toFixed(2)}`;
};
/** Color by the rounded value, so $0.00 stays neutral. */
const tone = (x: number) => (Math.round(x * 100) > 0 ? "pos" : Math.round(x * 100) < 0 ? "neg" : "");
const cents = (p: number) => `${Math.round(p * 100)}¢`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
let nextId = 1;

function fromMarket(m: PlayDTO, side: 0 | 1 = 0, stake = 50): LabPosition {
  const now: [number, number] = [m.outcomes[0]?.price ?? 0.5, m.outcomes[1]?.price ?? 0.5];
  return {
    id: `p${nextId++}`,
    marketId: m.id,
    question: m.question,
    sides: [m.outcomes[0]?.label ?? "Yes", m.outcomes[1]?.label ?? "No"],
    side,
    stake,
    entry: clampPrice(now[side]),
    now,
    hedge: 0,
    myOdds: null,
  };
}

function custom(): LabPosition {
  return {
    id: `p${nextId++}`,
    marketId: null,
    question: "Your own bet",
    sides: ["Your side", "Other side"],
    side: 0,
    stake: 50,
    entry: 0.4,
    now: [0.4, 0.6],
    hedge: 0,
    myOdds: null,
  };
}

type Tab = "map" | "lock" | "size" | "sim";
const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "Outcome map" },
  { id: "lock", label: "Lock it in" },
  { id: "size", label: "Size it" },
  { id: "sim", label: "Run it 1,000×" },
];

export function HedgeLab() {
  const { plays, reads, findPlay } = useBoard();
  const [raw, setRaw] = useState<LabPosition[]>([]);
  const [tab, setTab] = useState<Tab>("map");
  const [bankroll, setBankroll] = useState(500);

  // Live prices: positions from today's board follow the board's 20-second updates.
  const slip = useMemo(
    () =>
      raw.map((p) => {
        const m = p.marketId ? findPlay(p.marketId) : null;
        return m && m.outcomes.length === 2 ? { ...p, now: [m.outcomes[0].price, m.outcomes[1].price] as [number, number] } : p;
      }),
    [raw, findPlay]
  );
  const s = useMemo(() => summary(slip), [slip]);
  const update = (id: string, patch: Partial<LabPosition>) => setRaw((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => setRaw((list) => list.filter((p) => p.id !== id));
  const add = (p: LabPosition) => {
    track("lab_add_bet");
    setRaw((list) => (list.length >= MAX ? list : [...list, p]));
  };

  // An example slip from today's board: today's pick plus two other live markets.
  const loadExample = () => {
    track("lab_example");
    const two = (plays ?? []).filter((p) => p.outcomes.length === 2 && reads[p.id] && !reads[p.id].settled);
    const pick = todaysPick(plays, reads)?.play;
    const chosen = [pick, ...two.filter((p) => p.id !== pick?.id)].filter((p): p is PlayDTO => !!p).slice(0, 3);
    setRaw(chosen.map((m, i) => fromMarket(m, (reads[m.id]?.lean ?? 0) === 1 ? 1 : 0, [50, 30, 20][i])));
  };

  return (
    <section className="lab" aria-label="Hedge Lab">
      <header className="lab-head">
        <div className="lab-title">
          <HedgeLabMark />
          <h1>Hedge Lab</h1>
        </div>
        <p>Your personal betting sandbox. Build a slip, see every way it can land, lock in what you can, and play it out a thousand times before you risk a dollar.</p>
      </header>

      <Readout s={s} empty={!slip.length} />

      <div className="lab-grid">
        <aside className="lab-bench" aria-label="Your slip">
          <div className="lab-panel-h">
            <span>Your slip</span>
            <small>
              {slip.length}/{MAX} bets
            </small>
          </div>
          {!slip.length && (
            <div className="lab-empty">
              <b>Start an experiment.</b>
              <p>Add the bets you hold or are thinking about. Prices stay live.</p>
              <button className="lab-btn" onClick={loadExample} disabled={!plays?.length}>
                Load an example slip
              </button>
            </div>
          )}
          {slip.map((p, i) => (
            <PositionCard key={p.id} n={i + 1} p={p} onChange={(patch) => update(p.id, patch)} onRemove={() => remove(p.id)} />
          ))}
          {slip.length < MAX && (
            <div className="lab-add">
              <MarketSearch value={null} onPick={(m) => m && add(fromMarket(m))} />
              <button className="lab-link" onClick={() => add(custom())}>
                + Or enter your own numbers
              </button>
            </div>
          )}
          <label className="lab-bank">
            <span>Bankroll</span>
            <span className="lab-money">
              $
              <input type="number" min={0} step={50} value={bankroll} onChange={(e) => setBankroll(Math.max(0, Number(e.target.value) || 0))} />
            </span>
            <small>{s.staked > 0 && bankroll > 0 ? `${pct(s.staked / bankroll)} of it is on this slip` : "What you set aside for betting"}</small>
          </label>
        </aside>

        <div className="lab-inst">
          <nav className="lab-tabs" role="tablist" aria-label="Instruments">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="lab-panel" role="tabpanel">
            {!slip.length ? (
              <p className="lab-idle">Add a bet to your slip and the tools come alive.</p>
            ) : tab === "map" ? (
              <OutcomeMap slip={slip} />
            ) : tab === "lock" ? (
              <LockIt slip={slip} onChange={update} />
            ) : tab === "size" ? (
              <SizeIt slip={slip} bankroll={bankroll} onChange={update} />
            ) : (
              <RunIt slip={slip} staked={s.staked} />
            )}
          </div>
        </div>
      </div>
      <p className="lab-foot">Binary-market math: each share pays $1 if its side wins. Decision support, not financial advice. HedgePredict never places trades.</p>
    </section>
  );
}

function Readout({ s, empty }: { s: ReturnType<typeof summary>; empty: boolean }) {
  const cells = [
    { k: "Staked", v: money(s.staked) },
    { k: "Worth now", v: money(s.worth), sub: empty ? "" : money(s.worth - s.staked, true) },
    { k: "Best case", v: money(s.best, true), cls: tone(s.best) },
    { k: "Worst case", v: money(s.worst, true), cls: tone(s.worst) },
    { k: "Expected", v: money(s.expected, true), sub: "at market odds" },
  ];
  return (
    <div className={`lab-readout${empty ? " is-empty" : ""}`}>
      {cells.map((c) => (
        <div key={c.k}>
          <span>{c.k}</span>
          <b className={c.cls}>{empty ? "—" : c.v}</b>
          {c.sub && !empty && <small>{c.sub}</small>}
        </div>
      ))}
    </div>
  );
}

function PositionCard({ n, p, onChange, onRemove }: { n: number; p: LabPosition; onChange: (patch: Partial<LabPosition>) => void; onRemove: () => void }) {
  const o = outcomes(p);
  const w = worthNow(p);
  return (
    <article className="lab-pos">
      <div className="lab-pos-top">
        <i>{n}</i>
        {p.marketId ? (
          <b title={p.question}>{p.question}</b>
        ) : (
          <input className="lab-pos-name" value={p.question} onChange={(e) => onChange({ question: e.target.value })} aria-label="Bet name" />
        )}
        <button className="lab-x" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      </div>
      <div className="lab-sides" role="radiogroup" aria-label="Your side">
        {p.sides.map((label, k) => (
          <button
            key={k}
            role="radio"
            aria-checked={p.side === k}
            onClick={() => onChange({ side: k as 0 | 1, entry: clampPrice(p.now[k]), hedge: 0 })}
          >
            {label}
            <span>{cents(p.now[k])}</span>
          </button>
        ))}
      </div>
      <div className="lab-fields">
        <label>
          <span>Stake</span>
          <span className="lab-money">
            $
            <input type="number" min={0} step={5} value={p.stake} onChange={(e) => onChange({ stake: Math.max(0, Number(e.target.value) || 0) })} />
          </span>
        </label>
        <label>
          <span>Bought at</span>
          <span className="lab-money">
            <input
              type="number"
              min={1}
              max={99}
              value={Math.round(p.entry * 100)}
              onChange={(e) => onChange({ entry: clampPrice((Number(e.target.value) || 1) / 100) })}
            />
            ¢
          </span>
        </label>
        {!p.marketId && (
          <label>
            <span>Now</span>
            <span className="lab-money">
              <input
                type="number"
                min={1}
                max={99}
                value={Math.round(p.now[p.side] * 100)}
                onChange={(e) => {
                  const v = clampPrice((Number(e.target.value) || 1) / 100);
                  onChange({ now: (p.side === 0 ? [v, 1 - v] : [1 - v, v]) as [number, number] });
                }}
              />
              ¢
            </span>
          </label>
        )}
      </div>
      <dl className="lab-pos-out">
        <div>
          <dt>If it wins</dt>
          <dd className={tone(o.win)}>{money(o.win, true)}</dd>
        </div>
        <div>
          <dt>If it loses</dt>
          <dd className={tone(o.lose)}>{money(o.lose, true)}</dd>
        </div>
        <div>
          <dt>Worth now</dt>
          <dd>{money(w)}</dd>
        </div>
      </dl>
      {p.hedge > 0 && (
        <p className="lab-pos-hedge">
          Hedged {money(p.hedge)} on {p.sides[1 - p.side]}
        </p>
      )}
    </article>
  );
}

/** 01 · Every way the slip can land, best to worst, with the chance of each. */
function OutcomeMap({ slip }: { slip: LabPosition[] }) {
  const evs = events(slip, false);
  const sc = scenarios(evs);
  const scale = Math.max(1, ...sc.map((x) => Math.abs(x.pnl)));
  const best = sc[0];
  const worst = sc[sc.length - 1];
  return (
    <div className="lab-map">
      <p className="lab-lede">
        {sc.length} ways this can land. Chances come from today&apos;s prices.
      </p>
      <div className="lab-map-rows">
        {sc.map((x, i) => (
          <div key={i} className={`lab-map-row${x === best ? " is-best" : ""}${x === worst ? " is-worst" : ""}`}>
            <span className="lab-map-who">
              {x.winners.map((w, k) => (
                <em key={k} title={evs[k].question} className={tone(eventPnl(evs[k], w))}>
                  <i>{slip.indexOf(evs[k].positions[0]) + 1}</i>
                  {evs[k].sides[w]}
                </em>
              ))}
            </span>
            <span className="lab-map-p">{x.chance < 0.01 ? "<1%" : pct(x.chance)}</span>
            <span className="lab-bar" aria-hidden>
              <i className={x.pnl >= 0 ? "up" : "dn"} style={{ width: `${(Math.abs(x.pnl) / scale) * 50}%` }} />
            </span>
            <b className={tone(x.pnl)}>{money(x.pnl, true)}</b>
          </div>
        ))}
      </div>
      <p className="lab-note">Each row is one combination of winners: the number is the bet on your slip, the name is who wins. Green helps you, red hurts. Bets on the same market resolve together.</p>
    </div>
  );
}

/** 02 · Hedge each bet on the other side at today's price; watch the floor rise. */
function LockIt({ slip, onChange }: { slip: LabPosition[]; onChange: (id: string, patch: Partial<LabPosition>) => void }) {
  const s = summary(slip);
  const lockAll = () => slip.forEach((p) => onChange(p.id, { hedge: fullLock(p) }));
  const clear = () => slip.forEach((p) => onChange(p.id, { hedge: 0 }));
  return (
    <div className="lab-lock">
      <div className="lab-lock-top">
        <div>
          <span>Floor</span>
          <b className={tone(s.worst)}>{money(s.worst, true)}</b>
          <small>your worst case</small>
        </div>
        <div>
          <span>Ceiling</span>
          <b className={tone(s.best)}>{money(s.best, true)}</b>
          <small>your best case</small>
        </div>
        <div className="lab-lock-btns">
          <button className="lab-btn" onClick={lockAll}>
            Lock everything
          </button>
          <button className="lab-link" onClick={clear}>
            Clear hedges
          </button>
        </div>
      </div>
      {slip.map((p) => {
        const full = fullLock(p);
        const ratio = full > 0 ? Math.min(1.5, p.hedge / full) : 0;
        const o = outcomes(p);
        return (
          <div key={p.id} className="lab-lock-row">
            <div className="lab-lock-q">
              <b>{p.question}</b>
              <span>
                Holding {p.sides[p.side]}; hedge on {p.sides[1 - p.side]} at {cents(p.now[1 - p.side])}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              step={1}
              value={Math.round(ratio * 100)}
              onChange={(e) => onChange(p.id, { hedge: Math.round(full * (Number(e.target.value) / 100) * 100) / 100 })}
              style={{ ["--fill" as string]: `${(ratio / 1.5) * 100}%` }}
              aria-label={`Hedge size for ${p.question}`}
            />
            <div className="lab-lock-v">
              <b>{money(p.hedge)}</b>
              <small>{ratio > 0.995 && ratio < 1.005 ? "Fully locked" : ratio > 1 ? "Over-hedged" : ratio > 0 ? `${Math.round(ratio * 100)}% locked` : "No hedge"}</small>
              <small>
                {money(o.win, true)} / {money(o.lose, true)}
              </small>
            </div>
          </div>
        );
      })}
      <p className="lab-note">A full lock buys as many shares of the other side as you hold, so both outcomes pay the same. Past 100% you&apos;re betting against your own pick.</p>
    </div>
  );
}

/** 03 · Kelly sizing: how much a bankroll says to stake, given your odds vs the price. */
function SizeIt({ slip, bankroll, onChange }: { slip: LabPosition[]; bankroll: number; onChange: (id: string, patch: Partial<LabPosition>) => void }) {
  const [sel, setSel] = useState(slip[0]?.id);
  const p = slip.find((x) => x.id === sel) ?? slip[0];
  const price = clampPrice(p.now[p.side]);
  const mine = p.myOdds ?? price;
  const f = kelly(mine, price);
  const edge = mine - price;
  const tiers = [
    { k: "Full Kelly", f, note: "The mathematical max. Swingy." },
    { k: "Half Kelly", f: f / 2, note: "Most pros start here." },
    { k: "Quarter Kelly", f: f / 4, note: "Steady. Room to be wrong." },
  ];
  return (
    <div className="lab-size">
      <div className="lab-size-pick">
        {slip.map((x) => (
          <button key={x.id} aria-pressed={x.id === p.id} onClick={() => setSel(x.id)}>
            {x.question}
          </button>
        ))}
      </div>
      <div className="lab-size-odds">
        <div>
          <span>Market says</span>
          <b>{pct(price)}</b>
          <small>
            {p.sides[p.side]} at {cents(price)}
          </small>
        </div>
        <label>
          <span>You say</span>
          <b className={edge > 0.005 ? "pos" : ""}>{pct(mine)}</b>
          <input
            type="range"
            min={1}
            max={99}
            value={Math.round(mine * 100)}
            onChange={(e) => onChange(p.id, { myOdds: Number(e.target.value) / 100 })}
            style={{ ["--fill" as string]: `${mine * 100}%` }}
            aria-label="Your chance this side wins"
          />
        </label>
        <div>
          <span>Your edge</span>
          <b className={edge > 0.005 ? "pos" : edge < -0.005 ? "neg" : ""}>
            {edge > 0 ? "+" : edge < 0 ? "−" : ""}
            {Math.abs(Math.round(edge * 100))} pts
          </b>
          <small>{edge > 0.005 ? `${money(edge / price)} expected per $1` : "No edge at this price"}</small>
        </div>
      </div>
      {f <= 0 ? (
        <p className="lab-verdict">
          <b>Skip.</b> If you agree with the market ({pct(price)}), there&apos;s no edge, and the math says stake nothing. Slide &ldquo;You say&rdquo; to where you really think it lands.
        </p>
      ) : (
        <div className="lab-tiers">
          {tiers.map((t) => (
            <button
              key={t.k}
              className="lab-tier"
              onClick={() => onChange(p.id, { stake: Math.round(bankroll * t.f), entry: price, hedge: 0 })}
              title="Use this stake on the bench"
            >
              <span>{t.k}</span>
              <b>{money(bankroll * t.f)}</b>
              <small>
                {pct(t.f)} of bankroll · {t.note}
              </small>
            </button>
          ))}
        </div>
      )}
      <p className="lab-note">
        Kelly sizes a bet by how big your edge is: stake = (your odds − price) ÷ (1 − price) of your bankroll. It&apos;s only as good as your odds, so most people use a fraction. Tap a tier to put that stake on your slip.
      </p>
    </div>
  );
}

/** 04 · Play the whole slip out a thousand times. */
function RunIt({ slip, staked }: { slip: LabPosition[]; staked: number }) {
  const [seed, setSeed] = useState(7);
  const [mine, setMine] = useState(false);
  const hasMine = slip.some((p) => p.myOdds != null);
  const evs = events(slip, mine && hasMine);
  const res: SimResult = useMemo(() => simulate(evs, 1000, seed, staked), [evs, seed, staked]);
  const lo = Math.min(...res.runs);
  const hi = Math.max(...res.runs);
  const bins = 28;
  const counts = Array.from({ length: bins }, () => 0);
  for (const x of res.runs) counts[Math.min(bins - 1, Math.floor(((x - lo) / Math.max(1e-9, hi - lo)) * bins))]++;
  const top = Math.max(...counts);
  const zero = hi > lo ? ((0 - lo) / (hi - lo)) * 100 : 50;
  return (
    <div className="lab-sim">
      <div className="lab-sim-top">
        <button className="lab-btn" onClick={() => setSeed((x) => x + 1)}>
          Run again
        </button>
        <div className="lab-seg" role="group" aria-label="Whose odds">
          <button aria-pressed={!mine || !hasMine} onClick={() => setMine(false)}>
            Market odds
          </button>
          <button aria-pressed={mine && hasMine} onClick={() => setMine(true)} disabled={!hasMine} title={hasMine ? "" : "Set your odds in Size it first"}>
            My odds
          </button>
        </div>
      </div>
      <div className="lab-hist" key={seed + (mine ? 1000 : 0)} aria-label="How a thousand runs came out">
        {counts.map((c, i) => {
          const mid = lo + ((i + 0.5) / bins) * (hi - lo);
          return <i key={i} className={mid >= 0 ? "up" : "dn"} style={{ height: `${(c / top) * 100}%`, animationDelay: `${i * 18}ms` }} />;
        })}
        {zero > 0 && zero < 100 && <span className="lab-hist-zero" style={{ left: `${zero}%` }} />}
      </div>
      <div className="lab-hist-ax">
        <span>{money(lo, true)}</span>
        <span>break even</span>
        <span>{money(hi, true)}</span>
      </div>
      <div className="lab-stats">
        <div>
          <span>Finish up</span>
          <b className={res.up >= 0.5 ? "pos" : ""}>{pct(res.up)}</b>
          <small>of 1,000 runs</small>
        </div>
        <div>
          <span>Typical</span>
          <b className={tone(res.median)}>{money(res.median, true)}</b>
          <small>the middle run</small>
        </div>
        <div>
          <span>Bad day</span>
          <b className={tone(res.bad)}>{money(res.bad, true)}</b>
          <small>1 in 10 runs did worse</small>
        </div>
        <div>
          <span>Good day</span>
          <b className={tone(res.good)}>{money(res.good, true)}</b>
          <small>1 in 10 did better</small>
        </div>
        <div>
          <span>Lose it all</span>
          <b className={res.wipe > 0.25 ? "neg" : ""}>{pct(res.wipe)}</b>
          <small>every bet and hedge lost</small>
        </div>
      </div>
      <p className="lab-note">Each run settles every market at random, weighted by {mine && hasMine ? "your odds" : "today's prices"}. It shows the spread you&apos;re signing up for, not a prediction.</p>
    </div>
  );
}
