import type { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";
import { WhatIsJev } from "@/components/WhatIsJev";

export const metadata: Metadata = { title: "How it works · HedgePredict" };

export default function Page() {
  return (
    <div className="hp-page hp-stack">
      <HowItWorks />
      <WhatIsJev />
    </div>
  );
}
