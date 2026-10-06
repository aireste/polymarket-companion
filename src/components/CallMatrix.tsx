"use client";

import type { CallMatrix as Matrix, MatrixRow } from "@/lib/callHistory";
import { MARKET_TZ } from "@/lib/format";

const WORD = { wager: "Wager", hold: "Lean", skip: "Skip", decided: "Decided" } as const;
const cents = (x: number | null) => (x == null ? "" : ` ${Math.max(1, Math.min(99, Math.round(x * 100)))}¢`);
const money = (x: number | null) => (x == null ? "" : `${x < 0 ? "−" : "+"}$${Math.abs(x).toFixed(2)}`);
const slotLabel = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: MARKET_TZ, weekday: "short", hour: "numeric" });

/**
 * How the calls moved: one row per market, one cell per time slot, colored by the call in force
 * (Wager green, Lean amber, Skip gray). A red rule marks where a game went live; the last column
 * is where the call stands now, or how it paid off once the market resolved.
 */
export function CallMatrix({ matrix }: { matrix: Matrix }) {
  const start = Date.parse(matrix.start);
  const hours = Math.round((matrix.cols * matrix.stepMs) / 3_600_000);
  return (
    <section className="tr-sec cm">
      <h2>How the calls moved</h2>
      <p className="tr-sub">
        The last {hours} hours, one row per market. Each cell is {Math.round(matrix.stepMs / 3_600_000)} hours, colored by the call at the time:{" "}
        <b className="cm-k is-wager">Wager</b>, <b className="cm-k is-hold">Lean</b> or <b className="cm-k is-skip">Skip</b>. A red line marks
        where a game went live, where prices and calls move fastest. Calls made during a game aren&apos;t counted in the numbers above.
      </p>
      {matrix.rows.length === 0 ? (
        <p className="tr-none">This fills in as calls change.</p>
      ) : (
        <div className="cm-grid" role="table" aria-label="How each market's call changed over time">
          {matrix.rows.map((r) => (
            <Row key={r.marketId} row={r} start={start} step={matrix.stepMs} />
          ))}
          <div className="cm-axis" aria-hidden>
            <span />
            <div className="cm-axis-t">
              <span>{hours}h ago</span>
              <span>{hours / 2}h ago</span>
              <span>now</span>
            </div>
            <span />
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ row, start, step }: { row: MatrixRow; start: number; step: number }) {
  const status = row.result ? (
    <span className={`cm-res is-${row.result.result}`}>
      {row.result.result === "won" ? "Won" : row.result.result === "lost" ? "Lost" : "Void"}
      {row.result.result !== "void" && <b> {money(row.result.profit)}</b>}
      <small>
        {row.result.call} {row.result.side}
      </small>
    </span>
  ) : (
    <span className={`cm-now is-${row.last.action}`}>
      <small>Now</small>
      {WORD[row.last.action]}
      {row.last.side ? ` ${row.last.side}` : ""}
      {cents(row.last.price)}
    </span>
  );
  return (
    <div className="cm-row" role="row">
      <span className="cm-q" role="rowheader" title={row.question}>
        {row.question}
      </span>
      <div className="cm-cells" role="cell">
        {row.cells.map((c, i) => (
          <i
            key={i}
            className={`${c ? `is-${c}` : "is-none"}${row.liveCol === i ? " is-live" : ""}`}
            title={`${slotLabel(start + i * step)} ET · ${c ? WORD[c] : "no call yet"}`}
          />
        ))}
      </div>
      <span className="cm-st" role="cell">
        {status}
      </span>
    </div>
  );
}
