import { TIP_URL } from "@/lib/links";
import { Icon } from "./icons";

const PITCH = "HedgePredict is free, and I want to keep it that way. Tips cover the data and AI costs.";

/**
 * The tip jar. `row` sits at the top of the board, under the pick, so it's seen on every visit
 * (one plain row, never a banner or a pop-up). `link` is just the cup and "Buy me a coffee", for
 * the board's footer beside the Polymarket mark, so the ask isn't repeated in full. The default
 * is a quiet line for other pages.
 */
export function TipLine({ variant = "line" }: { variant?: "line" | "row" | "link" }) {
  if (variant === "link") {
    return (
      <a className="hp-tiplink" href={TIP_URL} target="_blank" rel="noopener noreferrer">
        {Icon.coffee}
        Buy me a coffee
      </a>
    );
  }
  if (variant === "row") {
    return (
      <a className="hp-tiprow" href={TIP_URL} target="_blank" rel="noopener noreferrer">
        <span>{PITCH}</span>
        <b>
          {Icon.coffee}
          Buy me a coffee
        </b>
      </a>
    );
  }
  return (
    <p className="hp-tip">
      {PITCH}{" "}
      <a href={TIP_URL} target="_blank" rel="noopener noreferrer">
        Buy me a coffee
      </a>
    </p>
  );
}
