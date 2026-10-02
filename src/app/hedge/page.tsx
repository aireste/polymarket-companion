import type { Metadata } from "next";
import { HedgeLab } from "@/components/HedgeLab";
import "../lab.css";

export const metadata: Metadata = { title: "Hedge Lab · HedgePredict" };

export default function Page() {
  return (
    <div className="hp-page hp-page-wide">
      <HedgeLab />
    </div>
  );
}
