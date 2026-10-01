import type { Metadata } from "next";
import { connection } from "next/server";
import { renderIssueHtml, todaysIssue } from "@/lib/newsletter";
import { SubscribeBox } from "@/components/SubscribeBox";
import { EmailPreview } from "@/components/EmailPreview";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HedgePredict Daily",
  description: "The day's best pick, what resolves next, and the biggest movers. Weekdays at 8 AM ET.",
};

const INSIDE = [
  { n: "01", k: "Today's pick", p: "The strongest call on the board, with the price and how sure we are." },
  { n: "02", k: "The board", p: "Every other market worth a look, in one line each." },
  { n: "03", k: "On the clock", p: "What resolves in the next 24 hours, with times in ET." },
  { n: "04", k: "Movers", p: "The biggest price swings of the last day." },
];

/** The Daily's landing page: the pitch + signup, and today's real email in a device frame. */
export default async function Page() {
  await connection();
  const issue = await todaysIssue().catch(() => null);
  const html = issue ? await renderIssueHtml(issue).catch(() => null) : null;

  return (
    <div className="hp-dl">
      <div className="hp-dl-copy">
        <Link href="/" className="hp-back">‹ Board</Link>
        <h1>HedgePredict Daily</h1>
        <p className="hp-dl-lede">
          The day&apos;s best pick, what&apos;s about to resolve, and the day&apos;s biggest movers. In your inbox every weekday at 8 AM ET. A 2-minute read.
        </p>
        <SubscribeBox source="daily-page" />
        <ol className="hp-dl-inside" aria-label="What's inside">
          {INSIDE.map((x) => (
            <li key={x.n}>
              <span>{x.n}</span>
              <div>
                <b>{x.k}</b>
                <p>{x.p}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="hp-dl-note">The preview is today&apos;s real issue, rendered exactly as it lands in your inbox.</p>
      </div>

      <div className="hp-dl-preview">
        {issue && html ? (
          <EmailPreview html={html} subject={issue.subject} from="HedgePredict Daily" />
        ) : (
          <p className="hp-empty">Today&apos;s issue isn&apos;t available right now. Try again in a minute.</p>
        )}
      </div>
    </div>
  );
}
