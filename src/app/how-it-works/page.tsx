import type { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";

export const metadata: Metadata = { title: "How it works · HedgePredict" };

export default function Page() {
  return (
    <div className="hp-page hp-page-wide">
      <HowItWorks />
    </div>
  );
}
