import type { Metadata } from "next";
import { ConnectAI } from "@/components/ConnectAI";

export const metadata: Metadata = { title: "Connect your AI · HedgePredict" };

export default function Page() {
  return (
    <div className="hp-page">
      <ConnectAI />
    </div>
  );
}
