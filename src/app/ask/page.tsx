import type { Metadata } from "next";
import { AskPanel } from "@/components/AskPanel";

export const metadata: Metadata = { title: "Ask · HedgePredict" };

export default async function Page({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  return (
    <div className="hp-page">
      <AskPanel initialQuestion={typeof q === "string" ? q.slice(0, 300) : undefined} />
    </div>
  );
}
