"use client";

import { TIP_URL } from "@/lib/links";
import { Icon } from "./icons";
import { track } from "@/lib/track";

/**
 * The coffee link. The wording is a thank-you option, never an ask: it says the site is free and
 * leaves the coffee to anyone who found it useful. No "tips", no reasons why money is needed.
 * `row` sits at the top of the board, under the pick, so it's seen on every visit
 * (one plain row, never a banner or a pop-up). `link` is just the cup and "Buy me a coffee", for
 * the board's footer beside the Polymarket mark, so the line isn't repeated in full. The default
 * is a quiet line for other pages.
 */
export function TipLine({ variant = "line" }: { variant?: "line" | "row" | "link" }) {
  if (variant === "link") {
    return (
      <a className="hp-tiplink" href={TIP_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("coffee_click", "footer")}>
        {Icon.coffee}
        Buy me a coffee
      </a>
    );
  }
  if (variant === "row") {
    return (
      <a className="hp-tiprow" href={TIP_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("coffee_click", "top")}>
        <span>I&apos;d love to keep HedgePredict free. Support helps cover the AI costs I pay out of pocket.</span>
        <b>
          {Icon.coffee}
          Buy me a coffee
        </b>
      </a>
    );
  }
  return (
    <p className="hp-tip">
      I&apos;d love to keep HedgePredict free. If it&apos;s been useful, you can{" "}
      <a href={TIP_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("coffee_click", "line")}>
        buy me a coffee
      </a>{" "}
      to help cover the AI costs I pay out of pocket.
    </p>
  );
}
