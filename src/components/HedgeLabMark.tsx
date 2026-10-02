import Link from "next/link";
import { Icon } from "./icons";

/**
 * Hedge Lab's own mark: a cyan tile with the scales. Cyan is the Lab's color
 * (pure math, no AI) so it never reads as part of HedgePredict's lime calls.
 */
export function HedgeLabMark() {
  return <span className="hl-mark" aria-hidden>{Icon.hedge}</span>;
}

export function HedgeLabLink() {
  return (
    <Link className="hl-link" href="/hedge">
      <HedgeLabMark />
      Hedge Lab
    </Link>
  );
}
