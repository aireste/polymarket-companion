import { TIP_URL } from "@/lib/links";

const PITCH = "HedgePredict is free, and I want to keep it that way. Tips cover the data and AI costs.";

/**
 * The tip jar. `row` sits at the top of the board, under the pick, so it's seen on every visit
 * (one plain row, never a banner or a pop-up); the default is a quiet line for page footers.
 */
export function TipLine({ variant = "line" }: { variant?: "line" | "row" }) {
  if (variant === "row") {
    return (
      <a className="hp-tiprow" href={TIP_URL} target="_blank" rel="noopener noreferrer">
        <span>{PITCH}</span>
        <b>Leave a tip →</b>
      </a>
    );
  }
  return (
    <p className="hp-tip">
      {PITCH}{" "}
      <a href={TIP_URL} target="_blank" rel="noopener noreferrer">
        Leave a tip
      </a>
    </p>
  );
}
