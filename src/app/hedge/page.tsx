import type { Metadata } from "next";
import { HedgeCalc } from "@/components/HedgeCalc";

export const metadata: Metadata = { title: "Hedge Lab · HedgePredict" };

export default function Page() {
  return (
    <div className="hp-page">
      <HedgeCalc />
    </div>
  );
}
