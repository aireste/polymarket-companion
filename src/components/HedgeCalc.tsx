"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayDTO } from "@/lib/dto";
import { analyzeHedge } from "@/lib/scoring";
import { useBoard } from "@/lib/boardStore";
import { Odo } from "./Odo";
import { HedgeLabMark } from "./HedgeLabMark";

const STAKES = [25, 50, 100, 250];
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
const cents = (p: number) => Math.min(99, Math.max(1, Math.round(p * 100)));

/**
 * Hedge Lab. Start from a live market or type your own numbers, then drag the
 * hedge size and watch both outcomes settle toward a lock. Pure math, no AI:
 * the same analyzeHedge() the MCP analyze_edge tool uses.
 */
export function HedgeCalc() {
  const [market, setMarket] = useState<PlayDTO | null>(null);
  const [stake, setStake] = useState(50);
  const [priceA, setPriceA] = useState(40); // cents you paid
  const [priceB, setPriceB] = useState(62); // cents for the other side now
  const [hedgePct, setHedgePct] = useState(100); // % of a full lock

  const loadMarket = (m: PlayDTO | null) => {
    setMarket(m);
    if (!m) return;
    const [a, b] = m.outcomes;
    setPriceA(cents(a?.price ?? 0.5));
    setPriceB(cents(b?.price ?? 1 - (a?.price ?? 0.5)));
    setHedgePct(100);
  };

  const result = useMemo(() => {
    try {
      const full = analyzeHedge({ stakeA: stake, priceA: priceA / 100, priceB: priceB / 100 });
      const a = analyzeHedge({
        stakeA: stake,
        priceA: priceA / 100,
        priceB: priceB / 100,
        hedgeStakeB: (full.fullLockStakeB * hedgePct) / 100,
      });
      return { a, full };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Check your inputs." };
    }
  }, [stake, priceA, priceB, hedgePct]);

  const a = "a" in result ? result.a : null;
  const scale = a ? Math.max(1, Math.abs(a.profitIfWin), Math.abs(a.profitIfLose), stake) : 1;
  const sideA = market?.outcomes[0]?.label ?? "Your side";
  const sideB = market?.outcomes[1]?.label ?? "Other side";

  return (
    <section className="hl" aria-label="Hedge Lab">
      <header className="hl-head">
        <div>
          <h1 className="hl-title">
            <HedgeLabMark />
            Hedge Lab
          </h1>
          <p>Lock in a result on a bet you already hold. Drag the hedge and watch both outcomes settle.</p>
        </div>
        <span className="hl-badge">Pure math · no AI</span>
      </header>

      <div className="hl-grid">
        <div className="hl-inputs">
          <div className="hl-field">
            <span className="hl-k">Start from a market</span>
            <MarketSearch value={market} onPick={loadMarket} />
          </div>

          <div className="hl-field">
            <span className="hl-k">Your stake</span>
            <div className="hl-money">
              <i>$</i>
              <input
                inputMode="decimal"
                value={stake}
                onChange={(e) => setStake(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))}
                aria-label="Your stake in dollars"
              />
            </div>
            <div className="hl-chips">
              {STAKES.map((s) => (
                <button key={s} className="hl-chip" aria-pressed={stake === s} onClick={() => setStake(s)}>
                  ${s}
                </button>
              ))}
            </div>
          </div>

          <PriceSlider label={`You bought ${sideA} at`} value={priceA} onChange={setPriceA} />
          <PriceSlider
            label={`${sideB} costs now`}
            value={priceB}
            onChange={setPriceB}
            hint={market ? "live price" : undefined}
          />
        </div>

        <div className="hl-readout featured">
          {"error" in result ? (
            <p className="hl-error">{result.error}</p>
          ) : (
            a && (
              <>
                <div className="hl-r-k">Put this on {sideB}</div>
                <div className="hl-r-big num">
                  <Odo value={money(a.hedgeStakeB)} />
                </div>
                <div className="hl-r-tags">
                  {a.isArb && <span className="hl-tag arb">Arbitrage: profit either way</span>}
                  {a.isFullyLocked && !a.isArb && <span className="hl-tag lock">Locked</span>}
                  {!a.isFullyLocked && <span className="hl-tag">{hedgePct}% of a full lock</span>}
                </div>

                <div className="hl-bars">
                  <OutcomeBar label={`If ${sideA} wins`} value={a.profitIfWin} scale={scale} />
                  <OutcomeBar label={`If ${sideB} wins`} value={a.profitIfLose} scale={scale} />
                </div>

                <label className="hl-hedge">
                  <span className="hl-r-k">
                    Hedge size <b className="num">{money(a.hedgeStakeB)}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    step={1}
                    value={hedgePct}
                    onChange={(e) => setHedgePct(Number(e.target.value))}
                    aria-label="Hedge size as a percent of a full lock"
                    style={{ ["--fill" as string]: `${(hedgePct / 150) * 100}%` }}
                  />
                  <span className="hl-hedge-scale">
                    <span>No hedge</span>
                    <button onClick={() => setHedgePct(100)} className="hl-lockmark">
                      Full lock
                    </button>
                    <span>Over-hedge</span>
                  </span>
                </label>

                <p className="hl-say">
                  {a.isFullyLocked ? (
                    <>
                      Whoever wins, you end at <b className={a.floor >= 0 ? "pos" : "neg"}>{money(a.floor)}</b>. You&apos;ve
                      traded upside for certainty.
                    </>
                  ) : hedgePct === 0 ? (
                    <>No hedge: you&apos;re all in on {sideA}.</>
                  ) : (
                    <>
                      You keep some upside on {hedgePct < 100 ? sideA : sideB}: the outcomes differ by{" "}
                      <b className="num">{money(Math.abs(a.profitIfWin - a.profitIfLose))}</b>.
                    </>
                  )}
                </p>
              </>
            )
          )}
        </div>
      </div>

      <p className="hedge-foot">
        Binary-market math: each share pays $1 if its side wins. Decision support, not financial advice.
      </p>
    </section>
  );
}

function PriceSlider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="hl-field">
      <span className="hl-k">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="hl-price">
        <input
          type="range"
          min={1}
          max={99}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ["--fill" as string]: `${((value - 1) / 98) * 100}%` }}
          aria-label={`${label}, in cents`}
        />
        <span className="hl-price-v num">
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(Math.min(99, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
            aria-label={`${label}, in cents (type)`}
          />
          ¢
        </span>
      </span>
    </label>
  );
}

/** Profit/loss for one outcome as a bar growing right (gain) or left (loss) from zero. */
function OutcomeBar({ label, value, scale }: { label: string; value: number; scale: number }) {
  const w = Math.min(50, (Math.abs(value) / scale) * 50);
  return (
    <div className="hl-bar">
      <span className="hl-bar-k">{label}</span>
      <span className="hl-bar-track" aria-hidden>
        <i className={value >= 0 ? "up" : "dn"} style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
      </span>
      <span className={`hl-bar-v num ${value >= 0 ? "pos" : "neg"}`}>
        <Odo value={money(value)} />
      </span>
    </div>
  );
}

const yesNo = (p: PlayDTO) => p.outcomes.map((o) => `${o.label} ${cents(o.price)}¢`).join(" · ");

/**
 * Find the market you're holding: today's board matches show instantly, then
 * all of Polymarket (debounced, like ⌘K). Only two-sided markets, since the
 * hedge math needs exactly one "other side". Empty = enter your own numbers.
 */
function MarketSearch({ value, onPick }: { value: PlayDTO | null; onPick: (m: PlayDTO | null) => void }) {
  const { plays } = useBoard();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PlayDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim().toLowerCase();

  const board = useMemo(() => (plays ?? []).filter((p) => p.outcomes.length === 2), [plays]);
  const local = useMemo(
    () => (term ? board.filter((p) => p.question.toLowerCase().includes(term)) : [...board].sort((a, b) => b.volume24hr - a.volume24hr)).slice(0, term ? 4 : 5),
    [board, term]
  );

  // All of Polymarket, once there's something to search for.
  useEffect(() => {
    if (term.length < 2) {
      setRemote([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { plays?: PlayDTO[] }) => setRemote((d.plays ?? []).filter((p) => p.outcomes.length === 2)))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [term]);

  const results = useMemo(() => {
    const seen = new Set(local.map((p) => p.id));
    return [...local, ...remote.filter((p) => !seen.has(p.id))].slice(0, 7);
  }, [local, remote]);

  useEffect(() => setHi(0), [term]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (m: PlayDTO) => {
    onPick(m);
    setQ("");
    setOpen(false);
  };

  if (value) {
    return (
      <div className="hl-picked">
        <div>
          <b>{value.question}</b>
          <span className="num">{yesNo(value)}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onPick(null);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="hl-search" ref={wrap}>
      <input
        ref={input}
        value={q}
        placeholder="Search a team, player or topic"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setHi((h) => Math.min(results.length - 1, h + 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setHi((h) => Math.max(0, h - 1)));
          else if (e.key === "Enter" && results[hi]) (e.preventDefault(), pick(results[hi]));
          else if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="hl-results"
        aria-autocomplete="list"
      />
      {open && (
        <div className="hl-results" id="hl-results" role="listbox">
          <p className="hl-results-k">{term ? (searching && !remote.length ? "Searching Polymarket…" : "Markets") : "Most traded today"}</p>
          {results.map((m, i) => (
            <button
              type="button"
              key={m.id}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? "is-hi" : undefined}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(m)}
            >
              <b>{m.question}</b>
              <span className="num">{yesNo(m)}</span>
            </button>
          ))}
          {term.length >= 2 && !searching && results.length === 0 && <p className="hl-results-none">No two-sided markets match. Try another word.</p>}
          <p className="hl-results-foot">Or skip this and enter your own numbers below.</p>
        </div>
      )}
    </div>
  );
}
