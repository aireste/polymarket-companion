"use client";

import { useMemo, useState } from "react";
import { analyzeHedge } from "@/lib/scoring";

/**
 * A standalone hedge calculator. Enter your stake and both prices; see the
 * hedge that locks an outcome and your profit/loss each way. Pure math, no AI,
 * no probability, no account. The app's namesake, made literal.
 */
export function HedgeCalc() {
  const [stake, setStake] = useState("100");
  const [priceA, setPriceA] = useState("40"); // cents
  const [priceB, setPriceB] = useState("62"); // cents
  const [customHedge, setCustomHedge] = useState(""); // blank = full lock

  const result = useMemo(() => {
    const s = parseFloat(stake);
    const pa = parseFloat(priceA) / 100;
    const pb = parseFloat(priceB) / 100;
    const custom = customHedge.trim() === "" ? undefined : parseFloat(customHedge);
    try {
      return {
        a: analyzeHedge({
          stakeA: s,
          priceA: pa,
          priceB: pb,
          hedgeStakeB: custom != null && Number.isFinite(custom) ? custom : undefined,
        }),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Check your inputs." };
    }
  }, [stake, priceA, priceB, customHedge]);

  const a = "a" in result ? result.a : null;
  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
  const [open, setOpen] = useState(false);

  return (
    <section
      className={`hedge collapse${open ? " open" : ""}`}
      id="hedge-calc"
      aria-label="Hedge calculator"
    >
      <button
        type="button"
        className="collapse-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="collapse-titles">
          <span className="collapse-title">Hedge calculator</span>
          <span className="collapse-sub">
            Plan a hedge on any bet: see the lock and your profit or loss each way.
          </span>
        </span>
        <span className="collapse-chev" aria-hidden>
          ▾
        </span>
      </button>

      <div className="collapse-body">
      <div className="hedge-inputs">
        <label className="hfield">
          <span>Your stake</span>
          <span className="hinput">
            <i>$</i>
            <input
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              aria-label="Your stake in dollars"
            />
          </span>
        </label>
        <label className="hfield">
          <span>Price you got</span>
          <span className="hinput">
            <input
              inputMode="decimal"
              value={priceA}
              onChange={(e) => setPriceA(e.target.value)}
              aria-label="Price you got, in cents"
            />
            <i>¢</i>
          </span>
        </label>
        <label className="hfield">
          <span>Other side price</span>
          <span className="hinput">
            <input
              inputMode="decimal"
              value={priceB}
              onChange={(e) => setPriceB(e.target.value)}
              aria-label="Other side price, in cents"
            />
            <i>¢</i>
          </span>
        </label>
      </div>

      {"error" in result && <p className="hedge-error">{result.error}</p>}

      {a && (
        <div className="hedge-result">
          <div className="hedge-lock">
            <div className="hedge-lock-k">To lock it, hedge</div>
            <div className="hedge-lock-v num">{money(a.fullLockStakeB)}</div>
            <div className="hedge-lock-sub">on the other side</div>
          </div>

          <div className="hedge-outcomes">
            <div className="hedge-oc">
              <span className="hedge-oc-k">If your side wins</span>
              <span className={`hedge-oc-v num ${a.profitIfWin >= 0 ? "pos" : "neg"}`}>
                {money(a.profitIfWin)}
              </span>
            </div>
            <div className="hedge-oc">
              <span className="hedge-oc-k">If it loses</span>
              <span className={`hedge-oc-v num ${a.profitIfLose >= 0 ? "pos" : "neg"}`}>
                {money(a.profitIfLose)}
              </span>
            </div>
          </div>

          <p className="hedge-verdict">
            {a.isArb ? (
              <>
                <span className="hedge-tag arb">Arbitrage</span>
                Both prices sum under 100¢, so a full hedge locks a guaranteed{" "}
                <b className="pos">{money(a.floor)}</b> either way.
              </>
            ) : a.isFullyLocked ? (
              <>
                A full hedge locks{" "}
                <b className={a.floor >= 0 ? "pos" : "neg"}>{money(a.floor)}</b>{" "}
                either way. You&apos;ve capped the outcome, up and down.
              </>
            ) : (
              <>
                This partial hedge leaves you{" "}
                <b className={a.profitIfWin >= 0 ? "pos" : "neg"}>{money(a.profitIfWin)}</b>{" "}
                if your side wins and{" "}
                <b className={a.profitIfLose >= 0 ? "pos" : "neg"}>{money(a.profitIfLose)}</b>{" "}
                if it loses.
              </>
            )}
          </p>

          <label className="hfield hedge-custom">
            <span>Adjust hedge amount (optional)</span>
            <span className="hinput">
              <i>$</i>
              <input
                inputMode="decimal"
                value={customHedge}
                onChange={(e) => setCustomHedge(e.target.value)}
                placeholder={a.fullLockStakeB.toFixed(2)}
                aria-label="Custom hedge amount"
              />
            </span>
          </label>
        </div>
      )}

      <p className="hedge-foot">
        Binary-market math (each share pays $1 on a win). Decision support, not financial advice.
      </p>
      </div>
    </section>
  );
}
