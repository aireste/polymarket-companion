import type { Metadata } from "next";
import { connection } from "next/server";
import { todaysIssue } from "@/lib/newsletter";
import { DailyWeb } from "@/components/DailyWeb";
import { SubscribeBox } from "@/components/SubscribeBox";

export const metadata: Metadata = {
  title: "HedgePredict Daily",
  description: "Jev's pick of the day, what resolves next, and the biggest movers. Weekdays at 8 AM ET.",
};

/** Today's issue, laid out for the web, with signup. */
export default async function Page() {
  await connection();
  const issue = await todaysIssue().catch(() => null);
  if (!issue) {
    return (
      <div className="hp-page">
        <h1 className="hp-dw-fallback">HedgePredict Daily</h1>
        <p className="hp-empty">Today&apos;s issue isn&apos;t available right now. Try again in a minute.</p>
        <SubscribeBox source="daily-page" />
      </div>
    );
  }
  return <DailyWeb issue={issue} />;
}
