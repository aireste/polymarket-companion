import { Suspense } from "react";
import type { Metadata } from "next";
import { Board } from "@/components/Board";

export const metadata: Metadata = { title: "Live now · HedgePredict" };

export default function Page() {
  return (
    <Suspense fallback={<div className="hp-boot" aria-hidden />}>
      <Board filter="live" />
    </Suspense>
  );
}
