import Link from "next/link";
import { Icon } from "./icons";

/**
 * Hedge Lab's own mark: a lemon tile with a flask (HedgePredict's spark bubbling inside). Lemon is the Lab's color
 * (pure math, no AI) so it never reads as part of HedgePredict's own calls.
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
