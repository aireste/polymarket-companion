import type { Metadata } from "next";
import { connection } from "next/server";
import { renderIssueHtml, todaysIssue } from "@/lib/newsletter";
import { SubscribeBox } from "@/components/SubscribeBox";

export const metadata: Metadata = {
  title: "HedgePredict Daily",
  description: "Jev's pick of the day, what resolves next, and the biggest movers. Weekdays at 8 AM ET.",
};

/** Today's issue on the web (the same HTML subscribers get), plus signup. */
export default async function Page() {
  await connection();
  let html: string | null = null;
  try {
    html = await renderIssueHtml(await todaysIssue());
  } catch {
    html = null;
  }
  return (
    <div className="hp-page hp-daily">
      <header className="hp-daily-head">
        <h1>HedgePredict Daily</h1>
        <p>A 2-minute read every weekday at 8 AM ET: Jev&apos;s pick, the board, what&apos;s on the clock, and the movers. Here&apos;s today&apos;s.</p>
      </header>
      <SubscribeBox />
      {html ? (
        <iframe className="hp-daily-frame" title="Today's HedgePredict Daily" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" />
      ) : (
        <p className="hp-empty">Today&apos;s issue isn&apos;t available right now. Try again in a minute.</p>
      )}
    </div>
  );
}
